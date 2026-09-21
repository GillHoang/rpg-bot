import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { users } from '../db/schema.js';

export type MenuPlayerState = Pick<
	typeof users.$inferSelect,
	'lastDailyClaimDate' | 'lastBossAttackDate' | 'overallStreak'
>;

/** Read model needed by menu availability and streak displays. */
export class MenuPlayerRepository {
	constructor(private readonly executor: Executor = db) {}

	async findState(discordId: string): Promise<MenuPlayerState | undefined> {
		const [user] = await this.executor
			.select({
				lastDailyClaimDate: users.lastDailyClaimDate,
				lastBossAttackDate: users.lastBossAttackDate,
				overallStreak: users.overallStreak,
			})
			.from(users)
			.where(eq(users.discordId, discordId));
		return user;
	}
}
