import { selectGateTier } from './RaidGatePolicy.js';
import type { GateTier } from '../../../shared/config/portals.js';
import { GATE_TEXT } from '../../../shared/ui/text/portals.js';
import { formatNumber } from '../../../shared/ui/text/format.js';
import { LOOT_CHEST_NAMES } from '../../../shared/ui/text/loot.js';
import {
	RAID_CONFIRMATION_TEXT,
	BOSS_ALREADY_DONE,
	BOSS_FEE_REQUIRED,
	BOSS_LEVEL_REQUIRED,
} from '../../../shared/ui/text/raid.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { Clock } from '../../../shared/kernel/clock.js';
import { systemClock } from '../../../shared/kernel/clock.js';
import { RaidRepository } from '../infrastructure/RaidRepository.js';
import type { Transaction } from '../../../db/client.js';
import { PlayerAccountRepository } from '../../identity/infrastructure/PlayerAccountRepository.js';
import type { PlayerAccount } from '../../identity/domain/PlayerAccount.js';
import { MonsterEncounterService, type MonsterStats } from './MonsterEncounterService.js';
import { UserCharacterRepository } from '../../identity/infrastructure/UserCharacterRepository.js';
import { RaidRewardService, type RaidRewardResult } from './RaidRewardService.js';
import { StatAssemblyService } from '../../combat-shared/application/StatAssemblyService.js';
import type { CombatSetup } from '../../combat-shared/application/CombatSetup.js';
import { createCombatant } from '../../combat-shared/domain/CombatantState.js';
import { BattleEngine, type BattleResult } from '../../combat-shared/domain/BattleEngine.js';
import { createBattleActionContext } from '../../combat-shared/domain/BattleActionContext.js';
import { PlayerCombatantFactory } from '../../combat-shared/application/combatantFactory.js';
import { scaleExpForMobLevel } from '../../../shared/config/expScaling.js';
import {
	RAID_LOOT_REGULAR,
	RAID_LOOT_ELITE,
	RAID_LOOT_BOSS,
	BOSS_ENTRY,
	RAID_HUNT_COOLDOWN_SECONDS,
	randInt,
	rollRaidChest,
} from '../../../shared/config/raidLoot.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';
import { CosmeticService } from '../../meta/application/CosmeticService.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import { DailyCycle } from '../../../shared/utils/dailyCycle.js';

import { MonsterStrategy } from '../../combat-shared/domain/classes/MonsterStrategy.js';
import { LootGrantService } from '../../economy/application/LootGrantService.js';

export type RaidResult =
	| { status: 'already-processed' }
	| { status: 'cooldown'; retryAt: Date }
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'no-monsters-seeded' }
	| { status: 'boss-locked'; message: string }
	| { status: 'portal-locked'; message: string }
	| {
			status: 'ok';
			battle: BattleResult;
			monsterName: string;
			credux: number;
			shards: number;
			expGained: number;
			gotChest: boolean;
			chestName: string;
			gearDrop: string | null;
			progress: RaidRewardResult;
	  };

export interface RaidRunOptions {
	gate?: number;
	tier?: number;
	requestId?: string;
	expectedDay?: string;
}

/** Dữ liệu đầu vào cho bước settle sau khi battle đã resolve trong transaction. */
interface RaidSettlement {
	now: Date;
	character: { highestRaidStreak: number };
	combatLevel: number;
	gatesCleared: number[];
	gateTier?: GateTier;
	monsterStats: MonsterStats;
	lootRng: () => number;
	battle: BattleResult;
}

export interface RaidDependencies {
	accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	monsters?: Pick<MonsterEncounterService, 'pickForLevel'>;
	characters?: Pick<UserCharacterRepository, 'hasCharacter'>;
	rewards?: Pick<RaidRewardService, 'grant' | 'currentWinStreak'>;
	statAssembly?: Pick<StatAssemblyService, 'assemble'>;
	cosmetics?: Pick<CosmeticService, 'grantTitleInTx'>;
	events?: Pick<EventBus, 'emit'>;
	clock?: Clock;

	persistence: PersistenceContext;
	queries?: Pick<
		RaidRepository,
		| 'lockBag'
		| 'lockCharacter'
		| 'findReceipt'
		| 'insertReceipt'
		| 'lockHuntCooldown'
		| 'upsertHuntCooldown'
		| 'updateCharacter'
		| 'lockUser'
		| 'updateUser'
		| 'updateBag'
	>;
	engine?: Pick<BattleEngine, 'resolve'>;
	factory?: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
	/** Shared combat preamble; individual engine/factory/statAssembly options take precedence when both are given. */
	combat?: Pick<CombatSetup, 'statAssembly' | 'factory' | 'engine'>;
	progress?: Pick<GameplayProgressCoordinator, 'apply'>;
	loot?: Pick<LootGrantService, 'gear'>;
}

function rollBattleRewards(lootRng: () => number, won: boolean, boss: boolean, mobType: string, combatLevel: number) {
	let table: typeof RAID_LOOT_BOSS | typeof RAID_LOOT_ELITE | typeof RAID_LOOT_REGULAR = RAID_LOOT_REGULAR;
	let chestField: 'silverChest' | 'goldChest' | 'bossTreasureChest' = 'silverChest';
	let chestName: string = LOOT_CHEST_NAMES.silver;
	if (boss) {
		table = RAID_LOOT_BOSS;
		chestField = 'bossTreasureChest';
		chestName = LOOT_CHEST_NAMES.boss;
	} else if (mobType === 'final' || mobType === 'elite') {
		// Final Boss gate & elite: thưởng bậc Elite (final miễn phí, không đụng daily boss fee).
		table = RAID_LOOT_ELITE;
		chestField = 'goldChest';
		chestName = LOOT_CHEST_NAMES.gold;
	}
	let credux = 0;
	let shards = 0;
	let baseExp: number;
	let gotChest = false;

	if (won) {
		credux = randInt(lootRng, table.win.creduxRange);
		baseExp = randInt(lootRng, table.win.expRange);
		shards = randInt(lootRng, table.win.shardsRange);
		gotChest = rollRaidChest(lootRng, table.win.chestChance);
	} else {
		baseExp = table.loss.exp;
	}
	const expGained = scaleExpForMobLevel(baseExp, combatLevel);
	return { credux, shards, expGained, gotChest, chestField, chestName };
}

/** Tên hiển thị của encounter: tiền tố portal (Gate/Tầng) + tên quái + bậc. */
function raidMonsterName(gateTier: GateTier | undefined, monsterStats: MonsterStats): string {
	const prefix = gateTier ? `${GATE_TEXT.gate(gateTier)} · ` : '';
	return `${prefix}${monsterStats.name} [${monsterStats.mobType}]`;
}

/**
 * Facade for `/raid hunt|boss`. Locks bag then character, builds stats and
 * resolves the battle in one transaction with entry fee/cooldown/rewards.
 * A failed reward grant rolls back the entry fee and daily boss attempt too.
 *
 * Combat stats now come from StatAssemblyService (class + weapon/armor +
 * active deity + rune stat-%, see its own doc comment for exactly what's
 * still simplified vs the original statAssembly.js).
 */

export class RaidService {
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly accounts: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	private readonly monsters: Pick<MonsterEncounterService, 'pickForLevel'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly rewards: Pick<RaidRewardService, 'grant' | 'currentWinStreak'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly cosmetics: Pick<CosmeticService, 'grantTitleInTx'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<
		RaidRepository,
		| 'lockBag'
		| 'lockCharacter'
		| 'findReceipt'
		| 'insertReceipt'
		| 'lockHuntCooldown'
		| 'upsertHuntCooldown'
		| 'updateCharacter'
		| 'lockUser'
		| 'updateUser'
		| 'updateBag'
	>;
	private readonly engine: Pick<BattleEngine, 'resolve'>;
	private readonly factory: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly loot: Pick<LootGrantService, 'gear'>;

	constructor(options: RaidDependencies) {
		// Compatibility fallback: production must inject via createAppContainer.
		this.persistence = requirePersistence(options, 'RaidService');
		this.clock = options.clock ?? systemClock;
		this.accounts = options.accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.monsters = options.monsters ?? new MonsterEncounterService();
		this.characters = options.characters ?? new UserCharacterRepository();
		this.rewards = options.rewards ?? new RaidRewardService();
		this.statAssembly =
			options.statAssembly ??
			options.combat?.statAssembly ??
			new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.cosmetics = options.cosmetics ?? new CosmeticService({ persistence: this.persistence });
		this.events = options.events ?? new EventBus();
		this.queries = options.queries ?? new RaidRepository();
		this.engine = options.engine ?? options.combat?.engine ?? new BattleEngine();
		this.factory = options.factory ?? options.combat?.factory ?? new PlayerCombatantFactory();
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.loot = options.loot ?? new LootGrantService();
	}

	async run(discordId: string, boss = false, options: RaidRunOptions = {}): Promise<RaidResult> {
		const result = await this.persistence.unitOfWork.run((tx) => this.runBattle(tx, discordId, boss, options));
		if (result.status !== 'ok') return result;
		const { credux, progress } = result;
		const won = result.battle.outcome === 'player_win';

		if (won)
			this.events.emit('battle.won', {
				discordId,
				battleType: boss ? 'boss' : 'raid',
				progressApplied: true,
			});
		else if (result.battle.outcome === 'enemy_win')
			this.events.emit('battle.lost', { discordId, battleType: boss ? 'boss' : 'raid' });
		if (credux > 0)
			this.events.emit('currency.earned', {
				discordId,
				currency: 'credux',
				amount: credux,
				source: boss ? 'boss' : 'raid',
			});
		if (progress.leveledUp) this.events.emit('level.up', { discordId, newLevel: progress.newLevel });

		return result;
	}

	private async runBattle(
		tx: Transaction,
		discordId: string,
		boss: boolean,
		options: RaidRunOptions,
	): Promise<RaidResult> {
		await this.queries.lockBag(tx, discordId);
		const action = createBattleActionContext({
			actorId: discordId,
			mode: boss ? 'boss' : 'raid',
			actionId: options.requestId,
			now: this.clock.now(),
		});
		const now = action.now;
		const day = DailyCycle.keyAt(now);
		const [character] = await this.queries.lockCharacter(tx, discordId);
		const account = await this.accounts.findByIdWithExecutor(tx, discordId);
		if (!account) return { status: 'not-registered' };
		if (!(await this.characters.hasCharacter(tx, discordId))) return { status: 'no-character' };
		const invalidAttempt = await this.validateAttempt(tx, discordId, boss, day, options);
		if (invalidAttempt) return invalidAttempt;

		const gatesCleared = [
			character.gate1TiersCleared,
			character.gate2TiersCleared,
			character.gate3TiersCleared,
			character.gate4TiersCleared,
			character.gate5TiersCleared,
		];
		const portal = await this.resolveGateTier(tx, discordId, now, gatesCleared, account.combatLevel, boss, options);
		if ('status' in portal) return portal;
		const gateTier = portal.tier;

		const lootRng = createRng(createSecureSeed());
		const monsterStats = await this.pickMonster(tx, lootRng, boss, gateTier, account.combatLevel);
		if (!monsterStats) return { status: 'no-monsters-seeded' };
		if (boss) {
			const locked = await this.bossGate(tx, discordId, account, day);
			if (locked) return locked;
		}

		const battle = await this.resolveBattle(tx, discordId, account, monsterStats, action);
		if (!boss) {
			await this.queries.upsertHuntCooldown(
				tx,
				discordId,
				new Date(now.getTime() + RAID_HUNT_COOLDOWN_SECONDS * 1000),
			);
		}
		return this.settle(tx, discordId, boss, options, {
			now,
			character,
			combatLevel: account.combatLevel,
			gatesCleared,
			gateTier,
			monsterStats,
			lootRng,
			battle,
		});
	}

	/**
	 * Hunt cooldown + portal gate/tier selection và các khoá tầng.
	 * Trả về RaidResult chặn (cooldown/portal-locked), hoặc tier cần đánh
	 * (rỗng với daily boss — không đi qua portal).
	 */
	private async resolveGateTier(
		tx: Transaction,
		discordId: string,
		now: Date,
		gatesCleared: number[],
		level: number,
		boss: boolean,
		options: RaidRunOptions,
	): Promise<{ tier?: GateTier } | RaidResult> {
		if (boss) return {};
		const [cooldown] = await this.queries.lockHuntCooldown(tx, discordId);
		if (cooldown && cooldown.readyAt > now) return { status: 'cooldown', retryAt: cooldown.readyAt };
		// SRP: pure gate/tier rules live in RaidGatePolicy; this method only
		// handles the hunt-cooldown lock then delegates.
		return selectGateTier(gatesCleared, level, options.gate, options.tier);
	}

	/** Chọn quái theo cấp mục tiêu (cấp tầng portal, fallback về cấp người chơi). */
	private pickMonster(
		tx: Transaction,
		lootRng: () => number,
		boss: boolean,
		gateTier: GateTier | undefined,
		combatLevel: number,
	): Promise<MonsterStats | null> {
		return this.monsters.pickForLevel(
			tx,
			gateTier?.level ?? combatLevel,
			lootRng,
			boss,
			gateTier?.finalBoss ?? false,
			gateTier?.gate.modifier ?? 'none',
		);
	}

	/** Dựng combatant player/monster và resolve battle trong engine. */
	private async resolveBattle(
		tx: Transaction,
		discordId: string,
		account: PlayerAccount,
		monsterStats: MonsterStats,
		action: ReturnType<typeof createBattleActionContext>,
	): Promise<BattleResult> {
		const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel, tx);
		const player = this.factory.createCombatant(account.username, account.combatClass, assembled);
		const playerStrategy = this.factory.createStrategy(account.combatClass, assembled);

		const monster = createCombatant({
			name: monsterStats.name,
			combatClass: null,
			hp: monsterStats.hp,
			atk: monsterStats.atk,
			def: monsterStats.def,
			crit: monsterStats.crit,
		});
		monster.immunityTags = monsterStats.immunityTags;
		return this.engine.resolve(player, monster, action.seed, {
			playerStrategy,
			enemyStrategy: new MonsterStrategy(monsterStats.skillKey),
		});
	}

	/** Roll thưởng, ghi tiến độ portal/streak/receipt — chỉ chạy sau khi battle đã resolve. */
	private async settle(
		tx: Transaction,
		discordId: string,
		boss: boolean,
		options: RaidRunOptions,
		ctx: RaidSettlement,
	): Promise<RaidResult> {
		const won = ctx.battle.outcome === 'player_win';
		const mobType = ctx.gateTier?.finalBoss ? 'final' : ctx.monsterStats.mobType;
		const { credux, shards, expGained, gotChest, chestField, chestName } = rollBattleRewards(
			ctx.lootRng,
			won,
			boss,
			mobType,
			ctx.gateTier?.level ?? ctx.combatLevel,
		);

		const progress = await this.rewards.grant(tx, discordId, {
			expGain: expGained,
			credux,
			shards,
			grantChest: gotChest,
			chestField,
			boss: boss || ctx.gateTier?.finalBoss,
			battleType: boss ? 'boss' : 'raid',
			enemyName: ctx.monsterStats.name,
			enemyTier: ctx.monsterStats.mobType as 'regular' | 'elite' | 'boss',
			outcome: ctx.battle.outcome,
		});
		if (won && ctx.gateTier)
			await this.queries.updateCharacter(tx, discordId, {
				[`gate${ctx.gateTier.gate.id}TiersCleared`]: Math.max(
					ctx.gatesCleared[ctx.gateTier.gate.id - 1] ?? 0,
					ctx.gateTier.number,
				),
			});
		await this.updateRaidStreak(tx, discordId, ctx.character.highestRaidStreak, won);
		const gearDrop = await this.grantRaidExtras(tx, discordId, ctx.lootRng, won, boss);
		if (won)
			await this.progress.apply(tx, discordId, ctx.gateTier?.finalBoss ? 'final_boss_win' : 'raid_win', ctx.now);
		if (options.requestId)
			await this.queries.insertReceipt(tx, {
				discordId,
				requestId: options.requestId,
				kind: boss ? 'boss' : 'hunt',
			});
		return {
			status: 'ok',
			battle: ctx.battle,
			monsterName: raidMonsterName(ctx.gateTier, ctx.monsterStats),
			credux,
			shards,
			expGained,
			gotChest,
			chestName,
			gearDrop,
			progress,
		};
	}

	private async validateAttempt(
		tx: Transaction,
		discordId: string,
		boss: boolean,
		day: string,
		options: RaidRunOptions,
	): Promise<RaidResult | null> {
		if (options.requestId) {
			const [receipt] = await this.queries.findReceipt(tx, discordId, options.requestId);
			if (receipt) return { status: 'already-processed' };
		}
		if (boss && options.expectedDay && options.expectedDay !== day) {
			return { status: 'boss-locked', message: RAID_CONFIRMATION_TEXT.dayChanged };
		}
		return null;
	}

	/** Win streak from the raid_logs tail that grant() just appended to; only the record streak is persisted. */
	private async updateRaidStreak(
		tx: Transaction,
		discordId: string,
		highestRaidStreak: number,
		won: boolean,
	): Promise<void> {
		if (!won) return;
		const streak = await this.rewards.currentWinStreak(tx, discordId);
		if (streak > highestRaidStreak) {
			await this.queries.updateCharacter(tx, discordId, { highestRaidStreak: streak });
		}
		if (streak >= 10) {
			// Chuỗi thắng raid 10 — title Unstoppable (idempotent).
			await this.cosmetics.grantTitleInTx(tx, discordId, 'streak_master');
		}
	}

	/** Boss-only extras: the Bakunawa Slayer title and the 30% Mythic gear drop. */
	private async grantRaidExtras(
		tx: Transaction,
		discordId: string,
		lootRng: () => number,
		won: boolean,
		boss: boolean,
	): Promise<string | null> {
		if (!won || !boss) return null;
		await this.cosmetics.grantTitleInTx(tx, discordId, 'boss_slayer');
		if (rollRaidChest(lootRng, BOSS_ENTRY.gearChance)) {
			return this.loot.gear(tx, discordId, 'Mythic', lootRng);
		}
		return null;
	}

	/** Boss entry gate: level, once-per-Vietnam-day cooldown, Credux fee. Returns a locked result, or null when the fight may proceed. */
	private async bossGate(
		tx: Transaction,
		discordId: string,
		account: PlayerAccount,
		day: string,
	): Promise<RaidResult | null> {
		if (account.combatLevel < BOSS_ENTRY.minLevel)
			return { status: 'boss-locked', message: BOSS_LEVEL_REQUIRED(BOSS_ENTRY.minLevel) };
		const [user] = await this.queries.lockUser(tx, discordId);
		if (user.lastBossAttackDate === day) return { status: 'boss-locked', message: BOSS_ALREADY_DONE };
		if (account.credux < BOSS_ENTRY.credux)
			return { status: 'boss-locked', message: BOSS_FEE_REQUIRED(formatNumber(BOSS_ENTRY.credux)) };
		await this.queries.updateUser(tx, discordId, { lastBossAttackDate: day });
		await this.queries.updateBag(tx, discordId, { credux: account.credux - BOSS_ENTRY.credux });
		return null;
	}
}
