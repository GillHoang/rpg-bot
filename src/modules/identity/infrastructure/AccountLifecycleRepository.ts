import { eq } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { usersBag, userCharacter } from '../../../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class AccountLifecycleRepository {
	async lockBag(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}

	async findBag(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
	}

	async updateStarterBalances(executor: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async lockCharacter(executor: Executor, discordId: string) {
		return executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1)
			.for('update');
	}

	async lockBagForClassChange(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
	}

	async updateClass(executor: Executor, discordId: string, values: Partial<typeof userCharacter.$inferInsert>) {
		return executor.update(userCharacter).set(values).where(eq(userCharacter.discordId, discordId));
	}

	async updateClassTokens(executor: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}
}
