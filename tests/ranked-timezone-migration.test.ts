import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './helpers/database.js';
import { rankedLogs, users } from '../src/db/schema.js';
import { RankedRepository } from '../src/repositories/RankedRepository.js';
import { weekWindowAt } from '../src/config/ranked.js';
import type { Executor } from '../src/db/client.js';

it('preserves UTC history and weekly boundaries across database session timezones', async () => {
	const { db, testClient } = createTestDatabase();
	const root = new URL('../src/db/migrations/', import.meta.url);
	try {
		const journal = JSON.parse(await readFile(new URL('meta/_journal.json', root), 'utf8'));
		for (const { tag } of journal.entries) {
			if (tag === '0007_ranked_log_timezone') break;
			await testClient.exec(await readFile(new URL(`${tag}.sql`, root), 'utf8'));
		}
		await db.insert(users).values({ discordId: 'timezone', username: 'Timezone' });
		await testClient.exec(`
			INSERT INTO ranked_logs (player_id, opponent_id, result, rating_before, rating_after, timestamp)
			VALUES ('timezone', 'other', 'draw', 1000, 1000, '2026-09-20 16:59:59.999');
			SET TIME ZONE 'Asia/Bangkok';
		`);
		await testClient.exec(await readFile(new URL('0007_ranked_log_timezone.sql', root), 'utf8'));
		const [preserved] = await db.select().from(rankedLogs);
		expect(preserved.timestamp.toISOString()).toBe('2026-09-20T16:59:59.999Z');
		const repo = new RankedRepository();
		const executor = db as unknown as Executor;
		const { startsAt } = weekWindowAt(new Date('2026-09-21T00:00:00Z'));
		for (const timezone of ['UTC', 'Asia/Bangkok', 'America/New_York']) {
			await testClient.exec(`SET TIME ZONE '${timezone}'`);
			await db
				.update(rankedLogs)
				.set({ timestamp: new Date(startsAt.getTime() - 1) })
				.where(eq(rankedLogs.id, preserved.id));
			expect(await repo.findWeeklyFight(executor, 'timezone', startsAt)).toHaveLength(0);
			await db.update(rankedLogs).set({ timestamp: startsAt }).where(eq(rankedLogs.id, preserved.id));
			expect(await repo.findWeeklyFight(executor, 'timezone', startsAt)).toHaveLength(1);
			const [roundTrip] = await db.select().from(rankedLogs).where(eq(rankedLogs.id, preserved.id));
			expect(roundTrip.timestamp.toISOString()).toBe(startsAt.toISOString());
			const [{ id: insertedId, timestamp }] = await db
				.insert(rankedLogs)
				.values({
					playerId: 'timezone',
					opponentId: 'other',
					result: 'draw',
					ratingBefore: 1000,
					ratingAfter: 1000,
				})
				.returning();
			expect(Math.abs(timestamp.getTime() - Date.now())).toBeLessThan(5000);
			await db.delete(rankedLogs).where(eq(rankedLogs.id, insertedId));
		}
	} finally {
		await testClient.close();
	}
}, 30000);
