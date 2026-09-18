import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userCharacter, usersBag, gameLogs } from '../db/schema.js';
import { applyCombatExp } from '../config/combatExp.js';

export interface RaidRewardGrant {
	expGain: number; // already scaled by scaleExpForMobLevel
	credux: number;
	shards: number;
	grantChest: boolean;
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
	grant(executor: Executor, discordId: string, grant: RaidRewardGrant): RaidRewardResult {
		const character = executor.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).get()!;
		const next = applyCombatExp(character.combatLevel, character.combatExp, grant.expGain);

		executor
			.update(userCharacter)
			.set({
				combatLevel: next.level,
				combatExp: next.exp,
				lifetimeExp: character.lifetimeExp + Math.max(0, grant.expGain),
				raidsWon: grant.credux > 0 ? character.raidsWon + 1 : character.raidsWon,
				raidsLost: grant.credux > 0 ? character.raidsLost : character.raidsLost + 1,
			})
			.where(eq(userCharacter.discordId, discordId))
			.run();

		if (grant.credux > 0 || grant.shards > 0 || grant.grantChest) {
			const bag = executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).get()!;
			const creduxAfter = bag.credux + grant.credux;
			const shardsAfter = bag.beliefShards + grant.shards;
			const chestAfter = grant.grantChest ? bag.silverChest + 1 : bag.silverChest;

			executor
				.update(usersBag)
				.set({
					credux: creduxAfter,
					beliefShards: shardsAfter,
					lifetimeCreduxEarned: bag.lifetimeCreduxEarned + grant.credux,
					silverChest: chestAfter,
				})
				.where(eq(usersBag.discordId, discordId))
				.run();

			if (grant.credux > 0) {
				executor
					.insert(gameLogs)
					.values({ discordId, action: 'Raid', previousCredux: bag.credux, updatedCredux: creduxAfter })
					.run();
			}
			if (grant.grantChest) {
				executor
					.insert(gameLogs)
					.values({
						discordId,
						action: 'Raid',
						itemType: 'silver_chest',
						previousChestCount: bag.silverChest,
						updatedChestCount: chestAfter,
					})
					.run();
			}
		}

		return { previousLevel: character.combatLevel, newLevel: next.level, leveledUp: next.leveledUp };
	}
}
