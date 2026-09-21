import { desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { raidLogs, userCharacter, usersBag, gameLogs } from '../db/schema.js';

export type RaidRewardBag = Pick<
	typeof usersBag.$inferSelect,
	'credux' | 'beliefShards' | 'lifetimeCreduxEarned' | 'silverChest' | 'goldChest' | 'bossTreasureChest'
>;
export type RaidRewardCharacter = Pick<
	typeof userCharacter.$inferSelect,
	'combatLevel' | 'combatExp' | 'lifetimeExp' | 'bossKills' | 'raidsWon' | 'raidsLost'
>;

/** Persistence operations only; the caller supplies the transaction and computed rewards. */
export class RaidRewardStore {
	async lockBag(executor: Executor, discordId: string): Promise<RaidRewardBag | undefined> {
		const [bag] = await executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
		return bag;
	}

	async lockCharacter(executor: Executor, discordId: string): Promise<RaidRewardCharacter | undefined> {
		const [character] = await executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1)
			.for('update');
		return character;
	}

	async updateCharacter(
		executor: Executor,
		discordId: string,
		patch: Partial<typeof userCharacter.$inferInsert>,
	): Promise<void> {
		await executor.update(userCharacter).set(patch).where(eq(userCharacter.discordId, discordId));
	}

	async updateBag(
		executor: Executor,
		discordId: string,
		patch: Partial<typeof usersBag.$inferInsert>,
	): Promise<void> {
		await executor.update(usersBag).set(patch).where(eq(usersBag.discordId, discordId));
	}

	async insertGameLog(executor: Executor, entry: typeof gameLogs.$inferInsert): Promise<void> {
		await executor.insert(gameLogs).values(entry);
	}

	async insertRaidLog(executor: Executor, entry: typeof raidLogs.$inferInsert): Promise<void> {
		await executor.insert(raidLogs).values(entry);
	}

	async recentResults(executor: Executor, discordId: string): Promise<{ result: string }[]> {
		return executor
			.select({ result: raidLogs.result })
			.from(raidLogs)
			.where(eq(raidLogs.discordId, discordId))
			.orderBy(desc(raidLogs.id))
			.limit(50);
	}
}
