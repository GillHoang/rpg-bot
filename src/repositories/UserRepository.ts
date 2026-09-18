import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { users, usersBag, pityCounters } from '../db/schema.js';

/**
 * Repository pattern for the `users` table and the two rows created
 * alongside it at registration (`users_bag`, `pity_counters`). Ported
 * from commands/rpg/register.js's handleConfirm.
 */
export class UserRepository {
	isRegistered(executor: Executor, discordId: string): boolean {
		return !!executor.select().from(users).where(eq(users.discordId, discordId)).get();
	}

	/**
	 * Inserts users -> users_bag -> pity_counters. Caller is expected to run
	 * this inside `db.transaction()` for atomicity, matching the original
	 * BEGIN/COMMIT flow. users_bag starts at all-zero defaults; the starter
	 * grant happens at character creation, not here.
	 */
	registerNew(executor: Executor, discordId: string, username: string): void {
		executor.insert(users).values({ discordId, username }).run();
		executor.insert(usersBag).values({ discordId }).run();
		executor.insert(pityCounters).values({ discordId }).run();
	}
}
