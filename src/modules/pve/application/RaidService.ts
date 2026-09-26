import { selectGateTier } from './RaidGatePolicy.js';
import type { GateTier } from '../../../shared/config/portals.js';
import { formatNumber } from '../../../shared/ui/text/format.js';
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
import { RaidRewardService } from './RaidRewardService.js';
import { RaidSettlementService } from './RaidSettlementService.js';
import type { RaidResult, RaidRunOptions } from './RaidTypes.js';
import { StatAssemblyService } from '../../combat-shared/application/StatAssemblyService.js';
import type { CombatSetup } from '../../combat-shared/application/CombatSetup.js';
import { createCombatant } from '../../combat-shared/domain/CombatantState.js';
import { BattleEngine, type BattleResult } from '../../combat-shared/domain/BattleEngine.js';
import { createBattleActionContext } from '../../combat-shared/domain/BattleActionContext.js';
import { PlayerCombatantFactory } from '../../combat-shared/application/combatantFactory.js';
import {
	BOSS_ENTRY,
	RAID_HUNT_COOLDOWN_SECONDS,
	BOSS_ROLLING_COOLDOWN_MINUTES,
} from '../../../shared/config/raidLoot.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';
import { CosmeticService } from '../../meta/application/CosmeticService.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import { DailyCycle } from '../../../shared/utils/dailyCycle.js';

import { MonsterStrategy } from '../../combat-shared/domain/classes/MonsterStrategy.js';
import { LootGrantService } from '../../economy/application/LootGrantService.js';

export type { RaidResult, RaidRunOptions } from './RaidTypes.js';

/** Cooldown overrides (seconds/minutes) — production defaults come from env-backed config. */
export interface RaidCooldowns {
	huntSeconds?: number;
	bossMinutes?: number;
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
		| 'findLastBossAttack'
		| 'updateUser'
		| 'updateBag'
	>;
	engine?: Pick<BattleEngine, 'resolve'>;
	factory?: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
	/** Shared combat preamble; individual engine/factory/statAssembly options take precedence when both are given. */
	combat?: Pick<CombatSetup, 'statAssembly' | 'factory' | 'engine'>;
	progress?: Pick<GameplayProgressCoordinator, 'apply'>;
	loot?: Pick<LootGrantService, 'gear'>;
	cooldowns?: RaidCooldowns;
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
		| 'findLastBossAttack'
		| 'updateUser'
		| 'updateBag'
	>;
	private readonly engine: Pick<BattleEngine, 'resolve'>;
	private readonly factory: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly loot: Pick<LootGrantService, 'gear'>;
	private readonly cooldowns: Required<RaidCooldowns>;
	private readonly settlement: RaidSettlementService;

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
		this.cooldowns = {
			huntSeconds: options.cooldowns?.huntSeconds ?? RAID_HUNT_COOLDOWN_SECONDS,
			bossMinutes: options.cooldowns?.bossMinutes ?? BOSS_ROLLING_COOLDOWN_MINUTES,
		};
		this.settlement = new RaidSettlementService({
			queries: this.queries,
			rewards: this.rewards,
			cosmetics: this.cosmetics,
			progress: this.progress,
			loot: this.loot,
		});
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
				new Date(now.getTime() + this.cooldowns.huntSeconds * 1000),
			);
		}
		return this.settlement.settle(tx, discordId, boss, options, {
			now,
			character,
			combatLevel: account.combatLevel,
			gatesCleared,
			gateTier,
			monsterStats,
			lootRng,
			...battle,
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
	): Promise<{ battle: BattleResult; playerSpd: number; enemySpd: number }> {
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
			spd: monsterStats.spd,
			acc: monsterStats.acc,
			eva: monsterStats.eva,
			ten: monsterStats.ten,
			damageType: monsterStats.damageType,
			armorType: monsterStats.armorType,
		});
		monster.immunityTags = monsterStats.immunityTags;
		monster.flags.regenPct = monsterStats.regenPct;
		const battle = this.engine.resolve(player, monster, action.seed, {
			playerStrategy,
			enemyStrategy: new MonsterStrategy(monsterStats.skillKey, { affixes: monsterStats.affixes }),
		});
		return { battle, playerSpd: assembled.stats.spd, enemySpd: monsterStats.spd };
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

	/** Boss entry gate: level, cooldown, Credux fee. Returns a locked result, or null when the fight may proceed. */
	private async bossGate(
		tx: Transaction,
		discordId: string,
		account: PlayerAccount,
		day: string,
	): Promise<RaidResult | null> {
		if (account.combatLevel < BOSS_ENTRY.minLevel)
			return { status: 'boss-locked', message: BOSS_LEVEL_REQUIRED(BOSS_ENTRY.minLevel) };
		const [user] = await this.queries.lockUser(tx, discordId);
		if (this.cooldowns.bossMinutes > 0) {
			// Test-server mode: rolling window from the latest boss attempt
			// (win or loss) replaces the calendar-day rule entirely.
			const last = await this.queries.findLastBossAttack(tx, discordId);
			if (last && this.clock.now().getTime() - last.getTime() < this.cooldowns.bossMinutes * 60_000)
				return { status: 'boss-locked', message: BOSS_ALREADY_DONE };
		} else if (user.lastBossAttackDate === day) {
			return { status: 'boss-locked', message: BOSS_ALREADY_DONE };
		}
		if (account.credux < BOSS_ENTRY.credux)
			return { status: 'boss-locked', message: BOSS_FEE_REQUIRED(formatNumber(BOSS_ENTRY.credux)) };
		await this.queries.updateUser(tx, discordId, { lastBossAttackDate: day });
		await this.queries.updateBag(tx, discordId, { credux: account.credux - BOSS_ENTRY.credux });
		return null;
	}
}
