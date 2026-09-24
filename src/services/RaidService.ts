import { GATES, findGateTier, defaultGateTier, highestAccessibleGate, gateUnlocked } from '../config/portals.js';
import { GATE_TEXT } from '../text/portals.js';
import { formatNumber } from '../text/format.js';
import { LOOT_CHEST_NAMES } from '../text/loot.js';
import { RAID_CONFIRMATION_TEXT, BOSS_ALREADY_DONE, BOSS_FEE_REQUIRED, BOSS_LEVEL_REQUIRED } from '../text/raid.js';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { RaidRepository } from '../repositories/RaidRepository.js';
import type { Transaction } from '../db/client.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import type { PlayerAccount } from '../domain/entities/PlayerAccount.js';
import { MonsterEncounterService } from './MonsterEncounterService.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { RaidRewardService, type RaidRewardResult } from './RaidRewardService.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { createCombatant } from '../domain/combat/CombatantState.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { createBattleActionContext } from '../domain/combat/BattleActionContext.js';
import { PlayerCombatantFactory } from './combatantFactory.js';
import { scaleExpForMobLevel } from '../config/expScaling.js';
import {
	RAID_LOOT_REGULAR,
	RAID_LOOT_ELITE,
	RAID_LOOT_BOSS,
	BOSS_ENTRY,
	RAID_HUNT_COOLDOWN_SECONDS,
	randInt,
	rollRaidChest,
} from '../config/raidLoot.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';
import { CosmeticService } from './CosmeticService.js';
import { GameplayProgressCoordinator } from './gameplayProgress.js';
import { DailyCycle } from '../utils/dailyCycle.js';

import { MonsterStrategy } from '../domain/combat/classes/MonsterStrategy.js';
import { LootGrantService } from './LootGrantService.js';

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

export interface RaidDependencies {
	accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	monsters?: Pick<MonsterEncounterService, 'pickForLevel'>;
	characters?: Pick<UserCharacterRepository, 'hasCharacter'>;
	rewards?: Pick<RaidRewardService, 'grant' | 'currentWinStreak'>;
	statAssembly?: Pick<StatAssemblyService, 'assemble'>;
	cosmetics?: Pick<CosmeticService, 'grantTitleInTx'>;
	events?: Pick<EventBus, 'emit'>;

	persistence?: PersistenceContext;
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
	} else if (mobType === 'final') {
		// Final Boss gate: thưởng bậc Elite (miễn phí, không đụng daily boss fee).
		table = RAID_LOOT_ELITE;
		chestField = 'goldChest';
		chestName = LOOT_CHEST_NAMES.gold;
	} else if (mobType === 'elite') {
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

	constructor(options: RaidDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.accounts = options.accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.monsters = options.monsters ?? new MonsterEncounterService();
		this.characters = options.characters ?? new UserCharacterRepository();
		this.rewards = options.rewards ?? new RaidRewardService();
		this.statAssembly =
			options.statAssembly ??
			new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.cosmetics = options.cosmetics ?? new CosmeticService({ persistence: this.persistence });
		this.events = options.events ?? EventBus.getInstance();
		this.queries = options.queries ?? new RaidRepository();
		this.engine = options.engine ?? new BattleEngine();
		this.factory = options.factory ?? new PlayerCombatantFactory();
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
		});
		const now = action.now;
		const day = DailyCycle.keyAt(now);
		const [character] = await this.queries.lockCharacter(tx, discordId);
		const account = await this.accounts.findByIdWithExecutor(tx, discordId);
		if (!account) return { status: 'not-registered' };
		if (!(await this.characters.hasCharacter(tx, discordId))) return { status: 'no-character' };
		const invalidAttempt = await this.validateAttempt(tx, discordId, boss, day, options);
		if (invalidAttempt) return invalidAttempt;
		if (!boss) {
			const [cooldown] = await this.queries.lockHuntCooldown(tx, discordId);
			if (cooldown && cooldown.readyAt > now) return { status: 'cooldown', retryAt: cooldown.readyAt };
		}

		const gatesCleared = [
			character.gate1TiersCleared,
			character.gate2TiersCleared,
			character.gate3TiersCleared,
			character.gate4TiersCleared,
			character.gate5TiersCleared,
		];
		const explicitMode = options.gate !== undefined || options.tier !== undefined;
		const gateTier = boss
			? undefined
			: explicitMode
				? findGateTier(options.gate ?? highestAccessibleGate(gatesCleared).id, options.tier ?? 1)
				: (() => {
						const gate = highestAccessibleGate(gatesCleared);
						return defaultGateTier(gatesCleared, gate);
					})();
		if (!boss && explicitMode && options.gate !== undefined && !GATES.some((g) => g.id === options.gate))
			return { status: 'portal-locked', message: GATE_TEXT.invalid };
		if (!boss && !gateTier) return { status: 'portal-locked', message: GATE_TEXT.invalid };
		if (!boss && !gateUnlocked(gateTier!.gate, gatesCleared, account.combatLevel))
			return { status: 'portal-locked', message: GATE_TEXT.locked(gateTier!.gate.minLevel) };
		if (!boss && gateTier!.number > (gatesCleared[gateTier!.gate.id - 1] ?? 0) + 1)
			return { status: 'portal-locked', message: GATE_TEXT.tierLocked() };
		const lootRng = createRng(createSecureSeed());
		const monsterStats = await this.monsters.pickForLevel(
			tx,
			gateTier?.level ?? account.combatLevel,
			lootRng,
			boss,
			gateTier?.finalBoss ?? false,
			gateTier?.gate.modifier ?? 'none',
		);
		if (!monsterStats) return { status: 'no-monsters-seeded' };
		if (boss) {
			const gate = await this.bossGate(tx, discordId, account, day);
			if (gate) return gate;
		}

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
		const battle = this.engine.resolve(player, monster, action.seed, {
			playerStrategy,
			enemyStrategy: new MonsterStrategy(monsterStats.skillKey),
		});
		if (!boss) {
			await this.queries.upsertHuntCooldown(
				tx,
				discordId,
				new Date(now.getTime() + RAID_HUNT_COOLDOWN_SECONDS * 1000),
			);
		}
		const won = battle.outcome === 'player_win';

		const { credux, shards, expGained, gotChest, chestField, chestName } = rollBattleRewards(
			lootRng,
			won,
			boss,
			gateTier?.finalBoss ? 'final' : monsterStats.mobType,
			gateTier?.level ?? account.combatLevel,
		);

		const progress = await this.rewards.grant(tx, discordId, {
			expGain: expGained,
			credux,
			shards,
			grantChest: gotChest,
			chestField,
			boss: boss || gateTier?.finalBoss,
			battleType: boss ? 'boss' : 'raid',
			enemyName: monsterStats.name,
			enemyTier: monsterStats.mobType as 'regular' | 'elite' | 'boss',
			outcome: battle.outcome,
		});
		if (won && gateTier)
			await this.queries.updateCharacter(tx, discordId, {
				[`gate${gateTier.gate.id}TiersCleared`]: Math.max(
					gatesCleared[gateTier.gate.id - 1] ?? 0,
					gateTier.number,
				),
			});
		await this.updateRaidStreak(tx, discordId, character.highestRaidStreak, won);
		const gearDrop = await this.grantRaidExtras(tx, discordId, lootRng, won, boss);
		if (won) await this.progress.apply(tx, discordId, gateTier?.finalBoss ? 'final_boss_win' : 'raid_win', now);
		if (options.requestId)
			await this.queries.insertReceipt(tx, {
				discordId,
				requestId: options.requestId,
				kind: boss ? 'boss' : 'hunt',
			});
		return {
			status: 'ok',
			battle,
			monsterName: `${gateTier ? GATE_TEXT.gate(gateTier) + ' · ' : ''}${monsterStats.name} [${monsterStats.mobType}]`,
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
