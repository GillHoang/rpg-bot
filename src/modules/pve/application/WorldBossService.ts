import { randomUUID } from 'node:crypto';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { Clock } from '../../../shared/kernel/clock.js';
import { systemClock } from '../../../shared/kernel/clock.js';
import type { Transaction } from '../../../db/client.js';
import { PlayerAccountRepository } from '../../identity/infrastructure/PlayerAccountRepository.js';
import type { PlayerAccount } from '../../identity/domain/PlayerAccount.js';
import { UserCharacterRepository } from '../../identity/infrastructure/UserCharacterRepository.js';
import { StatAssemblyService } from '../../combat-shared/application/StatAssemblyService.js';
import { PlayerCombatantFactory } from '../../combat-shared/application/combatantFactory.js';
import { createCombatant } from '../../combat-shared/domain/CombatantState.js';
import { BattleEngine, type BattleResult } from '../../combat-shared/domain/BattleEngine.js';
import { createBattleActionContext } from '../../combat-shared/domain/BattleActionContext.js';
import { MonsterStrategy } from '../../combat-shared/domain/classes/MonsterStrategy.js';
import { RaidRepository } from '../infrastructure/RaidRepository.js';
import { WorldBossRepository } from '../infrastructure/WorldBossRepository.js';
import {
	WORLD_BOSS,
	worldBossKillChest,
	worldBossKillCredux,
} from '../../../shared/config/worldBoss.js';
import { WORLD_BOSS_TEXT } from '../../../shared/ui/text/worldBoss.js';
import { DailyCycle } from '../../../shared/utils/dailyCycle.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';

export type WorldBossResult =
	| { status: 'already-processed' }
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'no-guild' }
	| { status: 'capped'; message: string }
	| { status: 'dead'; message: string }
	| {
			status: 'ok';
			battle: BattleResult;
			spawned: boolean;
			contribution: number;
			totalDamage: number;
			bossHpRemaining: number;
			bossMaxHp: number;
			killed: boolean;
			rank: number | null;
			killCredux: number;
			killChest: string | null;
	  };

export interface WorldBossBoardRow {
	rank: number;
	discordId: string;
	name: string;
	totalDamage: number;
}

export interface GuildWarRow {
	rank: number;
	guildId: string;
	totalDamage: number;
	attackers: number;
	/** War-eligible: at least 3 distinct attackers (no solo-guild farming). */
	eligible: boolean;
}

/**
 * Phase 5 guild World Boss: one shared HP pool per Discord guild, lazy spawn
 * on first attack, daily attack budget (auto_raids subscribers get +2), kill
 * purse split by contribution rank. Activates `boss_state`,
 * `boss_spawn_queue`, `boss_attack_log`, `auto_raids` and `boss_top_damage`.
 */
export class WorldBossService {
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly accounts: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<
		RaidRepository,
		'lockBag' | 'lockCharacter' | 'findReceipt' | 'insertReceipt' | 'updateCharacter'
	>;
	private readonly bosses: WorldBossRepository;
	private readonly engine: Pick<BattleEngine, 'resolve'>;
	private readonly factory: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;

	constructor(options: {
		accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
		characters?: Pick<UserCharacterRepository, 'hasCharacter'>;
		statAssembly?: Pick<StatAssemblyService, 'assemble'>;
		events?: Pick<EventBus, 'emit'>;
		clock?: Clock;
		persistence: PersistenceContext;
		queries?: Pick<
			RaidRepository,
			'lockBag' | 'lockCharacter' | 'findReceipt' | 'insertReceipt' | 'updateCharacter'
		>;
		bosses?: WorldBossRepository;
		engine?: Pick<BattleEngine, 'resolve'>;
		factory?: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
	}) {
		this.persistence = requirePersistence(options, 'WorldBossService');
		this.clock = options.clock ?? systemClock;
		this.accounts = options.accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.characters = options.characters ?? new UserCharacterRepository();
		this.statAssembly =
			options.statAssembly ?? new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.events = options.events ?? new EventBus();
		this.queries = options.queries ?? new RaidRepository();
		this.bosses = options.bosses ?? new WorldBossRepository();
		this.engine = options.engine ?? new BattleEngine();
		this.factory = options.factory ?? new PlayerCombatantFactory();
	}

	/** One attack against the guild's active World Boss (spawns it when absent). */
	async attack(guildId: string | null, discordId: string, requestId?: string): Promise<WorldBossResult> {
		if (!guildId) return { status: 'no-guild' };
		const result = await this.persistence.unitOfWork.run((tx) =>
			this.runAttack(tx, guildId, discordId, requestId),
		);
		if (result.status !== 'ok') return result;
		if (result.battle.outcome === 'player_win')
			this.events.emit('battle.won', { discordId, battleType: 'worldboss', progressApplied: true });
		else if (result.battle.outcome === 'enemy_win')
			this.events.emit('battle.lost', { discordId, battleType: 'worldboss', progressApplied: true });
		if (result.killCredux > 0)
			this.events.emit('currency.earned', {
				discordId,
				currency: 'credux',
				amount: result.killCredux,
				source: 'worldboss',
			});
		return result;
	}

	/** Contribution leaderboard for the guild's current (or latest) spawn. */
	async board(guildId: string | null, limit = 10): Promise<WorldBossBoardRow[]> {
		if (!guildId) return [];
		return this.persistence.unitOfWork.run(async (tx) => {
			const [boss] = await this.bosses.findBoss(tx, guildId);
			if (!boss) return [];
			const rows = await this.bosses.topAttackers(tx, boss.spawnId, limit);
			const board: WorldBossBoardRow[] = [];
			for (const [index, row] of rows.entries()) {
				const account = await this.accounts.findByIdWithExecutor(tx, row.discordId);
				board.push({
					rank: index + 1,
					discordId: row.discordId,
					name: account?.username ?? row.discordId,
					totalDamage: row.totalDamage,
				});
			}
			return board;
		});
	}

	/** Cross-guild damage race (Guild War board). */
	async warBoard(limit = 10): Promise<GuildWarRow[]> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const rows = await this.bosses.guildWarBoard(tx, limit);
			return rows.map((row, index) => ({
				rank: index + 1,
				guildId: row.guildId,
				totalDamage: Number(row.totalDamage),
				attackers: Number(row.attackers),
				eligible: Number(row.attackers) >= 3,
			}));
		});
	}

	/** Toggle the auto-raid subscription (+2 daily attacks, 7 days). */
	async toggleAuto(discordId: string): Promise<{ active: boolean; endsAt: Date }> {
		const now = this.clock.now();
		return this.persistence.unitOfWork.run(async (tx) => {
			const [existing] = await this.bosses.findAuto(tx, discordId);
			if (existing && existing.endsAt > now) {
				await this.bosses.upsertAuto(tx, {
					discordId,
					startedAt: existing.startedAt,
					endsAt: now,
					combatLevel: existing.combatLevel,
				});
				return { active: false, endsAt: now };
			}
			const endsAt = new Date(now.getTime() + 7 * 24 * 3_600_000);
			const account = await this.accounts.findByIdWithExecutor(tx, discordId);
			await this.bosses.upsertAuto(tx, {
				discordId,
				startedAt: now,
				endsAt,
				combatLevel: account?.combatLevel ?? 1,
			});
			return { active: true, endsAt };
		});
	}

	private async runAttack(
		tx: Transaction,
		guildId: string,
		discordId: string,
		requestId: string | undefined,
	): Promise<WorldBossResult> {
		if (requestId) {
			const [receipt] = await this.queries.findReceipt(tx, discordId, requestId);
			if (receipt) return { status: 'already-processed' };
		}
		await this.queries.lockBag(tx, discordId);
		const [character] = await this.queries.lockCharacter(tx, discordId);
		const account = await this.accounts.findByIdWithExecutor(tx, discordId);
		if (!account) return { status: 'not-registered' };
		if (!character || !(await this.characters.hasCharacter(tx, discordId))) return { status: 'no-character' };

		const now = this.clock.now();
		const day = DailyCycle.keyAt(now);
		const { boss, spawned } = await this.ensureBoss(tx, guildId, now, discordId);
		if (boss.status === 'dead') return { status: 'dead', message: WORLD_BOSS_TEXT.dead };

		const [auto] = await this.bosses.findAuto(tx, discordId);
		const autoActive = !!auto && auto.endsAt > now;
		const limit = autoActive ? WORLD_BOSS.autoDailyAttacks : WORLD_BOSS.dailyAttacks;
		const [attack] = await this.bosses.findAttack(tx, boss.spawnId, discordId);
		const spentToday = attack && attack.lastDailyReset === day ? attack.dailyAttacks : 0;
		if (spentToday >= limit) return { status: 'capped', message: WORLD_BOSS_TEXT.capped };

		const action = createBattleActionContext({ actorId: discordId, mode: 'boss', actionId: requestId, now });
		const battle = await this.resolveBattle(tx, discordId, account, action.seed);
		// Each attack fights a fresh full-HP boss: contribution is the damage
		// dealt in this battle, capped per attack (anti-exploit).
		const dealt = Math.max(0, WORLD_BOSS.maxHp - battle.enemyHpRemaining);
		const cap = Math.floor(WORLD_BOSS.maxHp * WORLD_BOSS.maxContributionPct);
		const contribution = Math.min(dealt, cap);
		const remaining = Math.max(0, boss.currentHp - contribution);
		const killed = remaining <= 0;

		await this.bosses.upsertAttack(
			tx,
			{
				bossSpawnId: boss.spawnId,
				guildId,
				discordId,
				mobId: WORLD_BOSS.mobId,
				attackedAt: now,
				lastDailyReset: day,
			},
			contribution,
			spentToday + 1,
			day,
		);
		const totalDamage = (attack?.totalDamage ?? 0) + contribution;
		// Phase 5 Guild War: participation marks guild activity for the war board.
		await this.bosses.touchActivity(tx, discordId, guildId, now);
		await this.bosses.updateBoss(tx, guildId, {
			currentHp: remaining,
			lastAttackAt: now,
			...(killed ? { status: 'dead' as const } : {}),
		});
		if (totalDamage > character.bossTopDamage) {
			await this.queries.updateCharacter(tx, discordId, { bossTopDamage: totalDamage });
		}
		if (requestId) await this.queries.insertReceipt(tx, { discordId, requestId, kind: 'worldboss' });

		let rank: number | null = null;
		let killCredux = 0;
		let killChest: string | null = null;
		if (killed) {
			const board = await this.bosses.topAttackers(tx, boss.spawnId, 50);
			rank = board.findIndex((row) => row.discordId === discordId) + 1 || null;
			for (const [index, row] of board.entries()) {
				const purse = worldBossKillCredux(index + 1);
				const chest = worldBossKillChest(index + 1);
				await this.bosses.grantPurse(tx, row.discordId, purse, chest);
			}
			if (rank) {
				killCredux = worldBossKillCredux(rank);
				killChest = worldBossKillChest(rank);
			}
		}
		return {
			status: 'ok',
			battle,
			spawned,
			contribution,
			totalDamage,
			bossHpRemaining: remaining,
			bossMaxHp: WORLD_BOSS.maxHp,
			killed,
			rank,
			killCredux,
			killChest,
		};
	}

	/** Lazy spawn: no active boss (or an expired one) becomes a fresh pool. */
	private async ensureBoss(
		tx: Transaction,
		guildId: string,
		now: Date,
		discordId: string,
	): Promise<{ boss: { spawnId: string; currentHp: number; status: string }; spawned: boolean }> {
		const [existing] = await this.bosses.findBoss(tx, guildId);
		// A finished (killed) spawn stays visible until expiry so the board
		// settles; only an expired spawn (or none) rolls a fresh pool.
		if (existing && existing.expiresAt > now) {
			return {
				boss: { spawnId: existing.spawnId, currentHp: existing.currentHp, status: existing.status },
				spawned: false,
			};
		}
		const spawnId = randomUUID();
		const expiresAt = new Date(now.getTime() + WORLD_BOSS.ttlMs);
		if (existing) {
			await this.bosses.updateBoss(tx, guildId, {
				spawnId,
				maxHp: WORLD_BOSS.maxHp,
				currentHp: WORLD_BOSS.maxHp,
				scaledAtk: WORLD_BOSS.atk,
				scaledDef: WORLD_BOSS.def,
				spawnAt: now,
				expiresAt,
				status: 'active',
				spawnSource: 'lazy',
				lastAttackAt: null,
				passiveState: null,
			});
		} else {
			await this.bosses.insertBoss(tx, {
				guildId,
				spawnId,
				mobId: WORLD_BOSS.mobId,
				bossLevel: 80,
				maxHp: WORLD_BOSS.maxHp,
				currentHp: WORLD_BOSS.maxHp,
				scaledAtk: WORLD_BOSS.atk,
				scaledDef: WORLD_BOSS.def,
				spawnAt: now,
				expiresAt,
				status: 'active',
				spawnSource: 'lazy',
			});
		}
		await this.bosses.recordSpawn(tx, {
			guildId,
			bossName: 'World Boss',
			requestedBy: discordId,
			status: 'spawned',
			spawnedAt: now,
			spawnId,
		});
		return { boss: { spawnId, currentHp: WORLD_BOSS.maxHp, status: 'active' }, spawned: true };
	}

	private async resolveBattle(
		tx: Transaction,
		discordId: string,
		account: PlayerAccount,
		seed: number | undefined,
	): Promise<BattleResult> {
		const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel, tx);
		const player = this.factory.createCombatant(account.username, account.combatClass, assembled);
		const playerStrategy = this.factory.createStrategy(account.combatClass, assembled);
		const boss = createCombatant({
			name: 'World Boss',
			combatClass: null,
			hp: WORLD_BOSS.maxHp,
			atk: WORLD_BOSS.atk,
			def: WORLD_BOSS.def,
			crit: WORLD_BOSS.crit,
			spd: WORLD_BOSS.spd,
			acc: WORLD_BOSS.acc,
			eva: WORLD_BOSS.eva,
			ten: WORLD_BOSS.ten,
		});
		const battle = this.engine.resolve(player, boss, seed, {
			playerStrategy,
			enemyStrategy: new MonsterStrategy(WORLD_BOSS.skillKey, { affixes: [], modifiers: [], finalBoss: false }),
		});
		return battle;
	}
}
