import { RAID_REWARD_ERROR_TEXT } from '../text/diagnostics.js';
import type { Executor } from '../db/client.js';
import { RaidRewardStore, type RaidRewardBag } from '../repositories/RaidRewardStore.js';
import { applyCombatExp } from '../config/combatExp.js';

export interface RaidRewardGrant {
	expGain: number; // already scaled by scaleExpForMobLevel
	credux: number;
	shards: number;
	grantChest: boolean;
	chestField?: 'silverChest' | 'goldChest' | 'bossTreasureChest';
	boss?: boolean;
	/** Battle metadata for the raid_logs history row. */
	battleType: 'raid' | 'boss';
	enemyName: string;
	enemyTier: 'regular' | 'elite' | 'boss';
	won: boolean;
}

export interface RaidRewardResult {
	previousLevel: number;
	newLevel: number;
	leveledUp: boolean;
}

/**
 * Ported from utils/awardCombatExp.js + the credux/shard/chest half of
 * commands/rpg/raid.js. Only `combat_level`/`combat_exp`/`lifetime_exp`
 * are updated here — per-level reward grants (utils/grantLevelRewards.js)
 * are a separate subsystem, deferred to a later milestone.
 */
export class RaidRewardService {
	constructor(
		private readonly store: Pick<
			RaidRewardStore,
			| 'lockBag'
			| 'lockCharacter'
			| 'updateCharacter'
			| 'updateBag'
			| 'insertGameLog'
			| 'insertRaidLog'
			| 'recentResults'
		> = new RaidRewardStore(),
	) {}

	async grant(executor: Executor, discordId: string, grant: RaidRewardGrant): Promise<RaidRewardResult> {
		const lockedBag = await this.store.lockBag(executor, discordId);
		const character = await this.store.lockCharacter(executor, discordId);
		if (!character) throw new Error(RAID_REWARD_ERROR_TEXT.missingCharacter(discordId));
		if (!lockedBag) throw new Error(RAID_REWARD_ERROR_TEXT.missingBag(discordId));
		const bag = lockedBag;
		const next = applyCombatExp(character.combatLevel, character.combatExp, grant.expGain);

		await this.store.updateCharacter(executor, discordId, {
			combatLevel: next.level,
			combatExp: next.exp,
			lifetimeExp: character.lifetimeExp + Math.max(0, grant.expGain),
			bossKills: character.bossKills + (grant.boss && grant.credux > 0 ? 1 : 0),
			raidsWon: !grant.boss && grant.credux > 0 ? character.raidsWon + 1 : character.raidsWon,
			raidsLost: !grant.boss && grant.credux === 0 ? character.raidsLost + 1 : character.raidsLost,
		});

		const creuxAfter = bag.credux + grant.credux;
		const shardsAfter = bag.beliefShards + grant.shards;
		const chestField = grant.chestField ?? 'silverChest';
		const chestAfter = bag[chestField] + (grant.grantChest ? 1 : 0);

		if (grant.credux > 0 || grant.shards > 0 || grant.grantChest) {
			await this.store.updateBag(executor, discordId, {
				credux: creuxAfter,
				beliefShards: shardsAfter,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + grant.credux,
				[chestField]: chestAfter,
			});
			await this.logRaidCurrency(executor, discordId, grant, bag, creuxAfter, chestField, chestAfter);
		}

		// History row for every battle — win or loss (the table was previously
		// never written; raid streaks below depend on it).
		await this.store.insertRaidLog(executor, {
			discordId,
			battleType: grant.battleType,
			enemyName: grant.enemyName,
			enemyTier: grant.enemyTier,
			result: grant.won ? 'win' : 'loss',
			expEarned: grant.expGain,
			updatedExp: next.exp,
			beliefShardsDropped: grant.shards,
			updatedBeliefShards: shardsAfter,
			creduxEarned: grant.credux,
			updatedCredux: creuxAfter,
			chestDropped: grant.grantChest ? chestField : null,
		});

		return { previousLevel: character.combatLevel, newLevel: next.level, leveledUp: next.leveledUp };
	}

	private async logRaidCurrency(
		executor: Executor,
		discordId: string,
		grant: RaidRewardGrant,
		bag: RaidRewardBag,
		creuxAfter: number,
		chestField: 'silverChest' | 'goldChest' | 'bossTreasureChest',
		chestAfter: number,
	): Promise<void> {
		if (grant.credux > 0) {
			await this.store.insertGameLog(executor, {
				discordId,
				action: 'Raid',
				previousCredux: bag.credux,
				updatedCredux: creuxAfter,
			});
		}
		if (grant.grantChest) {
			await this.store.insertGameLog(executor, {
				discordId,
				action: 'Raid',
				itemType: chestField,
				previousChestCount: bag[chestField],
				updatedChestCount: chestAfter,
			});
		}
	}

	/** Consecutive wins at the tail of raid_logs — for highestRaidStreak. */
	async currentWinStreak(executor: Executor, discordId: string): Promise<number> {
		const logs = await this.store.recentResults(executor, discordId);
		let streak = 0;
		for (const log of logs) {
			if (log.result !== 'win') break;
			streak += 1;
		}
		return streak;
	}
}
