import { and, eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { usersBag, pityCounters, userCharacter, userPresets, gameLogs, summonRewardGrants } from '../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class SummonRepository {
	async lockBag(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
	}

	async findPity(executor: Executor, discordId: string) {
		return executor.select().from(pityCounters).where(eq(pityCounters.discordId, discordId)).limit(1);
	}

	async lockCharacter(executor: Executor, discordId: string) {
		return executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1)
			.for('update');
	}

	async findPreset(executor: Executor, discordId: string, slot: number) {
		return executor
			.select()
			.from(userPresets)
			.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, slot)))
			.limit(1);
	}

	async insertShardLog(executor: Executor, values: typeof gameLogs.$inferInsert) {
		return executor.insert(gameLogs).values(values);
	}

	async upsertPity(executor: Executor, pityCount: number, values: typeof pityCounters.$inferInsert) {
		return executor
			.insert(pityCounters)
			.values(values)
			.onConflictDoUpdate({ target: pityCounters.discordId, set: { pityCount: pityCount } });
	}

	async updatePresetDeity(
		executor: Executor,
		discordId: string,
		slot: number,
		values: Partial<typeof userPresets.$inferInsert>,
	) {
		return executor
			.update(userPresets)
			.set(values)
			.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, slot)));
	}

	async updateRelicBalance(executor: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async insertRelicGrant(executor: Executor, values: typeof summonRewardGrants.$inferInsert) {
		return executor.insert(summonRewardGrants).values(values);
	}

	async updateShardBalance(executor: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async insertEssenceLog(executor: Executor, values: typeof gameLogs.$inferInsert) {
		return executor.insert(gameLogs).values(values);
	}

	async updateEssenceBalances(executor: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}
}
