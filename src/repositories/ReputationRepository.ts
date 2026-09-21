import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userCharacter } from '../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class ReputationRepository {
	async lockCharacter(executor: Executor, discordId: string) {
		return executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1)
			.for('update');
	}

	async updateProgress(executor: Executor, discordId: string, values: Partial<typeof userCharacter.$inferInsert>) {
		return executor.update(userCharacter).set(values).where(eq(userCharacter.discordId, discordId));
	}
}
