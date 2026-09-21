import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { usersBag, gameLogs } from '../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class AscensionRepository {
	async lockBag(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}

	async findBag(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
	}

	async updateSigilBalance(executor: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async insertSigilLog(executor: Executor, values: typeof gameLogs.$inferInsert) {
		return executor.insert(gameLogs).values(values);
	}

	async updateAscensionBalances(
		executor: Executor,
		discordId: string,
		values: Partial<typeof usersBag.$inferInsert>,
	) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async insertAscensionLog(executor: Executor, values: typeof gameLogs.$inferInsert) {
		return executor.insert(gameLogs).values(values);
	}
}
