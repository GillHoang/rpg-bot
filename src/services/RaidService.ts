import { db } from '../db/client.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import type { PlayerAccount } from '../domain/entities/PlayerAccount.js';
import { MonsterRepository } from '../repositories/MonsterRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { RaidRewardRepository, type RaidRewardResult } from '../repositories/RaidRewardRepository.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { createCombatant } from '../domain/combat/CombatantState.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { ClassStrategyRegistry } from '../domain/combat/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../domain/combat/RuneStrategyDecorator.js';
import { wrapWithBlessings } from '../domain/combat/DeityBlessingDecorator.js';
import { scaleExpForMobLevel } from '../config/expScaling.js';
import {
	RAID_LOOT_REGULAR,
	RAID_LOOT_ELITE,
	RAID_LOOT_BOSS,
	BOSS_ENTRY,
	randInt,
	rollRaidChest,
} from '../config/raidLoot.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';
import { CosmeticService } from './CosmeticService.js';
import { eq } from 'drizzle-orm';
import { users, usersBag, userCharacter } from '../db/schema.js';
import { DailyCycle } from '../utils/dailyCycle.js';
import { BOSS_ALREADY_DONE, BOSS_FEE_REQUIRED, BOSS_LEVEL_REQUIRED } from '../text/raid.js';
import { MonsterStrategy } from '../domain/combat/classes/MonsterStrategy.js';
import { LootRepository } from '../repositories/LootRepository.js';

export type RaidResult =
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'no-monsters-seeded' }
	| { status: 'boss-locked'; message: string }
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
	constructor(
		private readonly accounts = new PlayerAccountRepository(),
		private readonly monsters = new MonsterRepository(),
		private readonly characters = new UserCharacterRepository(),
		private readonly rewards = new RaidRewardRepository(),
		private readonly statAssembly = new StatAssemblyService(),
		private readonly cosmetics = new CosmeticService(),
		private readonly events = EventBus.getInstance(),
	) {}

	async run(discordId: string, boss = false): Promise<RaidResult> {
		const result = await db.transaction(async (tx): Promise<RaidResult> => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.for('update');
			const account = await this.accounts.findByIdWithExecutor(tx, discordId);
			if (!account) return { status: 'not-registered' };
			if (!(await this.characters.hasCharacter(tx, discordId))) return { status: 'no-character' };

			const lootRng = createRng(createSecureSeed());
			const monsterStats = await this.monsters.pickForLevel(tx, account.combatLevel, lootRng, boss);
			if (!monsterStats) return { status: 'no-monsters-seeded' };
			if (boss) {
				const gate = await this.bossGate(tx, discordId, account);
				if (gate) return gate;
			}

			const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel, tx);
			const player = createCombatant({
				name: account.username,
				combatClass: account.combatClass,
				hp: assembled.stats.hp,
				atk: assembled.stats.atk,
				def: assembled.stats.def,
				crit: assembled.stats.crit,
			});

			const baseStrategy = ClassStrategyRegistry.forClass(account.combatClass);
			const playerStrategy = wrapWithBlessings(
				wrapWithRunes(baseStrategy, assembled.combatEffectRunes),
				assembled.blessings,
			);

			const monster = createCombatant({
				name: monsterStats.name,
				combatClass: null,
				hp: monsterStats.hp,
				atk: monsterStats.atk,
				def: monsterStats.def,
				crit: monsterStats.crit,
			});

			monster.immunityTags = monsterStats.immunityTags;
			const battle = new BattleEngine().resolve(player, monster, createSecureSeed(), {
				playerStrategy,
				enemyStrategy: new MonsterStrategy(monsterStats.skillKey),
			});
			const won = battle.outcome === 'player_win';

			let table: typeof RAID_LOOT_BOSS | typeof RAID_LOOT_ELITE | typeof RAID_LOOT_REGULAR = RAID_LOOT_REGULAR;
			let chestField: 'silverChest' | 'goldChest' | 'bossTreasureChest' = 'silverChest';
			let chestName = 'Silver Chest';
			if (boss) {
				table = RAID_LOOT_BOSS;
				chestField = 'bossTreasureChest';
				chestName = 'Boss Treasure Chest';
			} else if (monsterStats.mobType === 'elite') {
				table = RAID_LOOT_ELITE;
				chestField = 'goldChest';
				chestName = 'Gold Chest';
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
			const expGained = scaleExpForMobLevel(baseExp, account.combatLevel);

			const progress = await this.rewards.grant(tx, discordId, {
				expGain: expGained,
				credux,
				shards,
				grantChest: gotChest,
				chestField,
				boss,
				battleType: boss ? 'boss' : 'raid',
				enemyName: monsterStats.name,
				enemyTier: monsterStats.mobType as 'regular' | 'elite' | 'boss',
				won,
			});
			await this.updateRaidStreak(tx, discordId, character.highestRaidStreak, won);
			const gearDrop = await this.grantRaidExtras(tx, discordId, lootRng, won, boss);
			return {
				status: 'ok',
				battle,
				monsterName: `${monsterStats.name} [${monsterStats.mobType}]`,
				credux,
				shards,
				expGained,
				gotChest,
				chestName,
				gearDrop,
				progress,
			};
		});
		if (result.status !== 'ok') return result;
		const { credux, progress } = result;
		const won = result.battle.outcome === 'player_win';

		this.events.emit(won ? 'battle.won' : 'battle.lost', { discordId, battleType: boss ? 'boss' : 'raid' });
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

	/** Win streak from the raid_logs tail that grant() just appended to; only the record streak is persisted. */
	private async updateRaidStreak(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		discordId: string,
		highestRaidStreak: number,
		won: boolean,
	): Promise<void> {
		if (!won) return;
		const streak = await this.rewards.currentWinStreak(tx, discordId);
		if (streak > highestRaidStreak) {
			await tx
				.update(userCharacter)
				.set({ highestRaidStreak: streak })
				.where(eq(userCharacter.discordId, discordId));
		}
	}

	/** Boss-only extras: the Bakunawa Slayer title and the 30% Mythic gear drop. */
	private async grantRaidExtras(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		discordId: string,
		lootRng: () => number,
		won: boolean,
		boss: boolean,
	): Promise<string | null> {
		if (!won || !boss) return null;
		await this.cosmetics.grantTitleInTx(tx, discordId, 'boss_slayer');
		if (rollRaidChest(lootRng, BOSS_ENTRY.gearChance)) {
			return new LootRepository().gear(tx, discordId, 'Mythic', lootRng);
		}
		return null;
	}

	/** Boss entry gate: level, once-per-Manila-day cooldown, Credux fee. Returns a locked result, or null when the fight may proceed. */
	private async bossGate(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		discordId: string,
		account: PlayerAccount,
	): Promise<RaidResult | null> {
		if (account.combatLevel < BOSS_ENTRY.minLevel)
			return { status: 'boss-locked', message: BOSS_LEVEL_REQUIRED(BOSS_ENTRY.minLevel) };
		const [user] = await tx.select().from(users).where(eq(users.discordId, discordId)).for('update');
		if (user.lastBossAttackDate === DailyCycle.keyAt())
			return { status: 'boss-locked', message: BOSS_ALREADY_DONE };
		if (account.credux < BOSS_ENTRY.credux)
			return { status: 'boss-locked', message: BOSS_FEE_REQUIRED(BOSS_ENTRY.credux.toLocaleString()) };
		await tx.update(users).set({ lastBossAttackDate: DailyCycle.keyAt() }).where(eq(users.discordId, discordId));
		await tx
			.update(usersBag)
			.set({ credux: account.credux - BOSS_ENTRY.credux })
			.where(eq(usersBag.discordId, discordId));
		return null;
	}
}
