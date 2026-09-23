import { eq, sql } from 'drizzle-orm';
import type { Transaction } from '../db/client.js';
import { seasons } from '../db/schema.js';
export class SeasonRepository {
	async lock(tx: Transaction) {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(42702)`);
	}
	async active(tx: Transaction) {
		return (await tx.select().from(seasons).where(eq(seasons.isActive, true)))[0];
	}
	async count(tx: Transaction) {
		return (await tx.select({ count: sql<number>`count(*)::int` }).from(seasons))[0].count;
	}
	async create(tx: Transaction, values: typeof seasons.$inferInsert) {
		return (await tx.insert(seasons).values(values).returning())[0];
	}
	async close(tx: Transaction, id: number) {
		await tx.update(seasons).set({ isActive: false }).where(eq(seasons.seasonId, id));
	}
}
