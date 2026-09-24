import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { sql } from 'drizzle-orm';

// Real PostgreSQL SQL/transactions in an isolated in-memory database. No .env,
// Discord token, network connection or production database is read by this suite.
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { ResetService } from '../src/modules/system/application/ResetService.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
}, 30000);
afterAll(async () => {
	await pool.end();
});

describe('ResetService', () => {
	it('countAll() counts without touching data — preview is destructive-free', async () => {
		const start = new StartService();
		for (const id of ['reset-count-a', 'reset-count-b', 'reset-count-c']) {
			const result = await start.start(id, id, 'Swordsman');
			if (result.status !== 'ok') throw new Error(result.status);
		}
		const reset = new ResetService();
		expect(await reset.countAll()).toBe(3);
		// Counting must not have wiped anything.
		expect(await db.select().from(s.users)).toHaveLength(3);

		// Cancel path: player counts again after "cancelling" (no resetAll call).
		expect(await reset.countAll()).toBe(3);

		// Only the explicit reset call wipes.
		expect(await reset.resetAll('developer')).toEqual({ status: 'ok', deletedUsers: 3 });
		expect(await db.select().from(s.users)).toHaveLength(0);
	});

	it('resetAll() deletes players but keeps seed catalogs and server config', async () => {
		await db.insert(s.serverConfig).values({ guildId: 'g1', prefix: '!' });
		const start = new StartService();
		for (const id of ['reset-a', 'reset-b']) {
			const result = await start.start(id, id, 'Knight');
			if (result.status !== 'ok') throw new Error(result.status);
		}
		expect(await db.select().from(s.users)).toHaveLength(2);
		expect(await db.select().from(s.userWeapons)).toHaveLength(2);

		const reset = new ResetService();
		const result = await reset.resetAll('developer');
		expect(result).toEqual({ status: 'ok', deletedUsers: 2 });

		// Player tables are empty.
		expect(await db.select().from(s.users)).toHaveLength(0);
		expect(await db.select().from(s.usersBag)).toHaveLength(0);
		expect(await db.select().from(s.userCharacter)).toHaveLength(0);
		expect(await db.select().from(s.userWeapons)).toHaveLength(0);
		expect(await db.select().from(s.userArmors)).toHaveLength(0);
		expect(await db.select().from(s.userPresets)).toHaveLength(0);
		// Seed catalogs and server config survive.
		expect(await db.select().from(s.weaponRoster)).toHaveLength(WEAPON_SEED.length);
		expect(await db.select().from(s.armorRoster)).toHaveLength(ARMOR_SEED.length);
		expect(await db.select().from(s.serverConfig)).toHaveLength(1);

		// Audit row lands in dev_logs.
		const logs = await db.select().from(s.devLogs);
		expect(logs).toHaveLength(2);
		expect(logs[0].actionType).toBe('reset_full');
	});

	it('reports nothing-to-reset when there are no users', async () => {
		// Previous test already wiped everything; audit row is in dev_logs only.
		const result = await new ResetService().resetAll('developer');
		expect(result).toEqual({ status: 'nothing-to-reset' });
	});

	it('resets cleanly a second time after players re-register', async () => {
		const start = new StartService();
		const result = await start.start('reset-c', 'reset-c', 'Mage');
		if (result.status !== 'ok') throw new Error(result.status);
		// Identity columns restarted, so freshly created rows work as before.
		expect(await db.select().from(s.userCharacter)).toHaveLength(1);
		expect((await new ResetService().resetAll('developer')) as { status: string }).toEqual({
			status: 'ok',
			deletedUsers: 1,
		});
		const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.users);
		expect(count).toBe(0);
	});
});
