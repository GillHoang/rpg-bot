import type { Executor } from '../db/client.js';
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import { activeRankedFights, rankedLogs, rankedReward, seasons, users, usersBag, userCharacter } from '../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class RankedRepository {
	async findUser(tx: Executor, discordId: string) {
		return tx.select().from(users).where(eq(users.discordId, discordId)).limit(1);
	}

	async lockCharacter(tx: Executor, discordId: string) {
		return tx.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1).for('update');
	}

	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
	}

	async createFightLock(tx: Executor, values: typeof activeRankedFights.$inferInsert) {
		return tx.insert(activeRankedFights).values(values).onConflictDoNothing().returning();
	}

	async deleteFightLock(tx: Executor, discordId: string) {
		return tx.delete(activeRankedFights).where(eq(activeRankedFights.discordId, discordId));
	}

	async findWeeklyFight(tx: Executor, discordId: string, startsAt: Date) {
		return tx
			.select({ id: rankedLogs.id })
			.from(rankedLogs)
			.where(and(eq(rankedLogs.playerId, discordId), gte(rankedLogs.timestamp, startsAt)))
			.limit(1);
	}

	async findWeeklyReward(tx: Executor, bracket: string) {
		return tx.select().from(rankedReward).where(eq(rankedReward.bracket, bracket)).limit(1);
	}

	async updateBag(tx: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return tx.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async updateCharacter(tx: Executor, discordId: string, values: Partial<typeof userCharacter.$inferInsert>) {
		return tx.update(userCharacter).set(values).where(eq(userCharacter.discordId, discordId));
	}

	async findCharacter(tx: Executor, discordId: string) {
		return tx.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1);
	}

	async insertLog(tx: Executor, values: typeof rankedLogs.$inferInsert) {
		return tx.insert(rankedLogs).values(values);
	}

	async findOpponentInWindow(tx: Executor, discordId: string, rating: number, window: number) {
		return tx
			.select()
			.from(userCharacter)
			.innerJoin(users, eq(users.discordId, userCharacter.discordId))
			.where(
				and(
					ne(userCharacter.discordId, discordId),
					eq(users.isBanned, false),
					sql`abs(${userCharacter.pvpRating} - ${rating}) <= ${window}`,
				),
			)
			.orderBy(sql`random()`)
			.limit(1);
	}

	async findRecentResults(tx: Executor, discordId: string) {
		return tx
			.select({ result: rankedLogs.result })
			.from(rankedLogs)
			.where(eq(rankedLogs.playerId, discordId))
			.orderBy(desc(rankedLogs.id))
			.limit(50);
	}

	async findActiveSeason(tx: Executor) {
		return tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
	}

	async countSeasons(tx: Executor) {
		return tx.select({ count: sql<number>`count(*)::int` }).from(seasons);
	}

	async insertSeason(tx: Executor, values: typeof seasons.$inferInsert) {
		return tx.insert(seasons).values(values);
	}
}
