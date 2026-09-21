import type { Executor } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { usersBag } from '../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class EnhancementStateRepository {
	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}
}
