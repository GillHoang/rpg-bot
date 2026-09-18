import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userCharacter, usersBag, gameLogs } from '../db/schema.js';
import { applyCombatExp } from '../config/combatExp.js';

export interface RaidRewardGrant {
	expGain: number; // already scaled by scaleExpForMobLevel
	credux: number;
	shards: number;
	grantChest: boolean;
	chestField?: 'silverChest' | 'goldChest' | 'bossTreasureChest';
	boss?: boolean;
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
export class RaidRewardRepository {
	async grant(executor: Executor, discordId: string, grant: RaidRewardGrant): Promise<RaidRewardResult> {
		const [lockedBag] = await executor
			.select()
			.from(usersBag)
			.where(eq(usersBag.discordId, discordId))
			.for('update');
		const [character] = await executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1)
			.for('update');
		if (!character) throw new Error(`grant: no user_character row for ${discordId}`);
		const next = applyCombatExp(character.combatLevel, character.combatExp, grant.expGain);

		await executor
			.update(userCharacter)
			.set({
				combatLevel: next.level,
				combatExp: next.exp,
				lifetimeExp: character.lifetimeExp + Math.max(0, grant.expGain),
				bossKills: character.bossKills + (grant.boss && grant.credux > 0 ? 1 : 0),
				raidsWon: !grant.boss && grant.credux > 0 ? character.raidsWon + 1 : character.raidsWon,
				raidsLost: !grant.boss && grant.credux === 0 ? character.raidsLost + 1 : character.raidsLost,
			})
			.where(eq(userCharacter.discordId, discordId));

		if (grant.credux > 0 || grant.shards > 0 || grant.grantChest) {
			const bag = lockedBag;
			if (!bag) throw new Error(`grant: no users_bag row for ${discordId}`);
			const creduxAfter = bag.credux + grant.credux;
			const shardsAfter = bag.beliefShards + grant.shards;
			const chestField = grant.chestField ?? 'silverChest';
			const chestAfter = bag[chestField] + (grant.grantChest ? 1 : 0);

			await executor
				.update(usersBag)
				.set({
					credux: creduxAfter,
					beliefShards: shardsAfter,
					lifetimeCreduxEarned: bag.lifetimeCreduxEarned + grant.credux,
					[chestField]: chestAfter,
				})
				.where(eq(usersBag.discordId, discordId));

			if (grant.credux > 0) {
				await executor
					.insert(gameLogs)
					.values({ discordId, action: 'Raid', previousCredux: bag.credux, updatedCredux: creduxAfter });
			}
			if (grant.grantChest) {
				await executor.insert(gameLogs).values({
					discordId,
					action: 'Raid',
					itemType: chestField,
					previousChestCount: bag[chestField],
					updatedChestCount: chestAfter,
				});
			}
		}

		return { previousLevel: character.combatLevel, newLevel: next.level, leveledUp: next.leveledUp };
	}
}
