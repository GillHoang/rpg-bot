import type { Executor } from '../../../db/client.js';
import { and, eq, lte } from 'drizzle-orm';
import { activeCasinoSessions, usersBag, casinoLogs } from '../../../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class CasinoSessionRepository {
	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}

	async findActiveSessions(tx: Executor, discordId: string) {
		return tx
			.select()
			.from(activeCasinoSessions)
			.where(and(eq(activeCasinoSessions.discordId, discordId), eq(activeCasinoSessions.status, 'active')));
	}

	async createSession(tx: Executor, values: typeof activeCasinoSessions.$inferInsert) {
		return tx.insert(activeCasinoSessions).values(values).returning();
	}

	async updateBag(tx: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return tx.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async lockOwnedSession(tx: Executor, sessionId: string, discordId: string) {
		return tx
			.select()
			.from(activeCasinoSessions)
			.where(and(eq(activeCasinoSessions.sessionId, sessionId), eq(activeCasinoSessions.discordId, discordId)))
			.for('update');
	}

	async updateSession(tx: Executor, sessionId: string, values: Partial<typeof activeCasinoSessions.$inferInsert>) {
		return tx.update(activeCasinoSessions).set(values).where(eq(activeCasinoSessions.sessionId, sessionId));
	}

	async findBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId));
	}

	async insertLog(tx: Executor, values: typeof casinoLogs.$inferInsert) {
		return tx.insert(casinoLogs).values(values);
	}

	async findExpiredSessions(tx: Executor, now: Date) {
		return tx
			.select()
			.from(activeCasinoSessions)
			.where(and(eq(activeCasinoSessions.status, 'active'), lte(activeCasinoSessions.expiresAt, now)));
	}
}
