import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userCharacter, titleCatalog } from '../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class ProfileQueryRepository {
	async findCharacter(executor: Executor, discordId: string) {
		return executor.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1);
	}

	async findTitleDisplay(executor: Executor, titleId: number) {
		return executor
			.select({ display: titleCatalog.display })
			.from(titleCatalog)
			.where(eq(titleCatalog.titleId, titleId))
			.limit(1);
	}
}
