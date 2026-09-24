import type { Executor } from '../../../db/client.js';
import { eq } from 'drizzle-orm';
import { usersBag } from '../../../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class LootInventoryRepository {
	async updateBag(tx: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return tx.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}
}
