import type { Executor } from '../db/client.js';
import { and, eq, lte, sql } from 'drizzle-orm';
import {
	activeDuelParticipants,
	activeDuels,
	pvpLogs,
	users,
	usersBag,
	userCharacter,
	wagerLogs,
} from '../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class DuelRepository {
	async createDuel(tx: Executor, values: typeof activeDuels.$inferInsert) {
		return tx.insert(activeDuels).values(values);
	}

	async createParticipants(tx: Executor, values: (typeof activeDuelParticipants.$inferInsert)[]) {
		return tx.insert(activeDuelParticipants).values(values);
	}

	async findUser(tx: Executor, discordId: string) {
		return tx.select().from(users).where(eq(users.discordId, discordId)).limit(1);
	}

	async findParticipant(tx: Executor, discordId: string) {
		return tx.select().from(activeDuelParticipants).where(eq(activeDuelParticipants.discordId, discordId)).limit(1);
	}

	async findBalance(tx: Executor, discordId: string) {
		return tx.select({ creux: usersBag.credux }).from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
	}

	async deleteDuel(tx: Executor, duelId: string) {
		return tx.delete(activeDuels).where(eq(activeDuels.duelId, duelId));
	}

	async lockDuel(tx: Executor, duelId: string) {
		return tx.select().from(activeDuels).where(eq(activeDuels.duelId, duelId)).limit(1).for('update');
	}

	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
	}

	async lockCharacter(tx: Executor, discordId: string) {
		return tx.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1).for('update');
	}

	async debitStake(tx: Executor, discordId: string, stake: number) {
		return tx
			.update(usersBag)
			.set({ credux: sql`${usersBag.credux} - ${stake}` })
			.where(eq(usersBag.discordId, discordId));
	}

	async updateBag(tx: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return tx.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async updateCharacter(tx: Executor, discordId: string, values: Partial<typeof userCharacter.$inferInsert>) {
		return tx.update(userCharacter).set(values).where(eq(userCharacter.discordId, discordId));
	}

	async insertPvpLog(tx: Executor, values: typeof pvpLogs.$inferInsert) {
		return tx.insert(pvpLogs).values(values);
	}

	async insertWagerLog(tx: Executor, values: typeof wagerLogs.$inferInsert) {
		return tx.insert(wagerLogs).values(values);
	}

	async deleteExpiredDuels(tx: Executor, now: Date) {
		return tx
			.delete(activeDuels)
			.where(and(eq(activeDuels.status, 'pending'), lte(activeDuels.expiresAt, now)))
			.returning({ duelId: activeDuels.duelId });
	}
}
