import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { users, userCharacter } from '../db/schema.js';

export type MenuPlayerState = Pick<
	typeof users.$inferSelect,
	'lastDailyClaimDate' | 'lastBossAttackDate' | 'overallStreak'
> & {
	gate1TiersCleared?: number | null;
	gate2TiersCleared?: number | null;
	gate3TiersCleared?: number | null;
	gate4TiersCleared?: number | null;
	gate5TiersCleared?: number | null;
};

/** Read model needed by menu availability and streak displays. */
export class MenuPlayerRepository {
	constructor(private readonly executor: Executor = db) {}

	async findState(discordId: string): Promise<MenuPlayerState | undefined> {
		const [user] = await this.executor
			.select({
				lastDailyClaimDate: users.lastDailyClaimDate,
				lastBossAttackDate: users.lastBossAttackDate,
				overallStreak: users.overallStreak,
				gate1TiersCleared: userCharacter.gate1TiersCleared,
				gate2TiersCleared: userCharacter.gate2TiersCleared,
				gate3TiersCleared: userCharacter.gate3TiersCleared,
				gate4TiersCleared: userCharacter.gate4TiersCleared,
				gate5TiersCleared: userCharacter.gate5TiersCleared,
			})
			.from(users)
			.leftJoin(userCharacter, eq(users.discordId, userCharacter.discordId))
			.where(eq(users.discordId, discordId));
		return user;
	}
}
