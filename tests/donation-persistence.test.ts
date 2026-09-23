import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateTestDatabase } from './helpers/database.js';

const db = new PGlite();

beforeAll(() => migrateTestDatabase(db), 30_000);
afterAll(() => db.close());

describe('donation migration', () => {
	it('stores a contribution without a game account or supporter tier', async () => {
		await db.exec(`INSERT INTO donation_orders
			(order_id, discord_id, amount, payment_code, tier_id, request_id, expires_at)
			VALUES ('order-1', 'supporter-without-character', 10000, 'ALPOABC123', NULL, 'interaction-1', now() + interval '30 minutes')`);
		const order = await db.query<{ discord_id: string; tier_id: string | null }>(
			`SELECT discord_id, tier_id FROM donation_orders WHERE order_id = 'order-1'`,
		);
		expect(order.rows[0]).toMatchObject({ discord_id: 'supporter-without-character', tier_id: null });
	});

	it('prevents duplicate interaction IDs and payment codes', async () => {
		await expect(
			db.exec(`INSERT INTO donation_orders
			(order_id, discord_id, amount, payment_code, request_id, expires_at)
			VALUES ('order-2', 'another', 10000, 'ALPOOTHER', 'interaction-1', now() + interval '30 minutes')`),
		).rejects.toThrow();
		await expect(
			db.exec(`INSERT INTO donation_orders
			(order_id, discord_id, amount, payment_code, request_id, expires_at)
			VALUES ('order-3', 'another', 10000, 'ALPOABC123', 'interaction-3', now() + interval '30 minutes')`),
		).rejects.toThrow();
	});

	it('retains payment history when game users are reset', async () => {
		await db.exec(`INSERT INTO donation_grant_receipts
			(operation_id, order_id, subject, plan_slug, entitlements)
			VALUES ('job-1', 'order-1', 'supporter-without-character', 'supporter', '[]')`);
		await db.exec(`INSERT INTO users(discord_id, username) VALUES ('game-user', 'Player')`);
		await db.exec(`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
		const retained = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM donation_orders');
		expect(retained.rows[0]?.count).toBe(1);
		const receipts = await db.query<{ count: number }>(
			'SELECT count(*)::int AS count FROM donation_grant_receipts',
		);
		expect(receipts.rows[0]?.count).toBe(1);
	});
});
