import { and, eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userCharacter, userPresets } from '../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class PlayerLoadoutQueryRepository {
	async findCharacter(executor: Executor, discordId: string) {
		return executor.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1);
	}

	async findPreset(executor: Executor, discordId: string, slot: number) {
		return executor
			.select()
			.from(userPresets)
			.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, slot)))
			.limit(1);
	}
}
