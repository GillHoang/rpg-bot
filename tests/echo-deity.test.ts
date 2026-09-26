import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { testPersistence } from './helpers/persistence.js';
import { eq, and } from 'drizzle-orm';

vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { LoadoutService } from '../src/modules/progression/application/LoadoutService.js';
import { DeityService } from '../src/modules/progression/application/DeityService.js';
import { StatAssemblyService } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { DEITY_SEED } from '../src/modules/progression/seed/deities.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';

let id: string;
let sequence = 0;

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.deityRoster).values(DEITY_SEED);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
}, 120000);
afterAll(async () => {
	await pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `echo-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
	await db.insert(s.userDeities).values([
		{ discordId: id, deityId: 1, currAtk: 100, currHp: 400, currDef: 40, lastPullDate: '2026-01-01' },
		{ discordId: id, deityId: 2, currAtk: 200, currHp: 800, currDef: 80, lastPullDate: '2026-01-01' },
	]);
});

const loadout = () => new LoadoutService({ persistence: testPersistence() });
const assemble = () =>
	new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);

async function userDeityId(deityId: number): Promise<number> {
	const [row] = await db
		.select({ userDeityId: s.userDeities.userDeityId })
		.from(s.userDeities)
		.where(and(eq(s.userDeities.discordId, id), eq(s.userDeities.deityId, deityId)));
	return row!.userDeityId;
}

describe('echo deity (Phase 3)', () => {
	it('equips a 4th distinct deity and adds flat 25% of its stats', async () => {
		const ud1 = await userDeityId(1);
		const ud2 = await userDeityId(2);
		expect((await loadout().equip(id, 'deity', String(ud1))).ok).toBe(true);
		const before = await assemble();
		expect((await loadout().equip(id, 'echo', String(ud2))).ok).toBe(true);
		const after = await assemble();
		// Echo adds a flat 25% of the deity's effective (sigil-derived) stats.
		const info = await new DeityService().findUserDeityAssemblyInfo(db, ud2);
		expect(info).not.toBeNull();
		expect(after.stats.atk - before.stats.atk).toBe(Math.floor(info!.currAtk * 0.25));
		expect(after.stats.hp - before.stats.hp).toBe(Math.floor(info!.currHp * 0.25));
		expect(after.stats.def - before.stats.def).toBe(Math.floor(info!.currDef * 0.25));
		// No extra blessing from echo.
		expect(after.blessings).toEqual(before.blessings);
	});

	it('rejects unowned deities and pantheon duplicates', async () => {
		const ud1 = await userDeityId(1);
		expect(await loadout().equip(id, 'echo', '99999')).toEqual(expect.objectContaining({ ok: false }));
		expect((await loadout().equip(id, 'deity', String(ud1))).ok).toBe(true);
		expect(await loadout().equip(id, 'echo', String(ud1))).toEqual(expect.objectContaining({ ok: false }));
	});
});
