import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { testPersistence } from './helpers/persistence.js';
import { eq } from 'drizzle-orm';

vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { BranchService } from '../src/modules/progression/application/BranchService.js';
import { StatAssemblyService } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { computeClassStats } from '../src/shared/config/classes.js';
import { branchesForClass } from '../src/shared/config/branches.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';

let id: string;
let sequence = 0;

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
}, 120000);
afterAll(async () => {
	await pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `branch-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
});

const branch = () => new BranchService({ persistence: testPersistence() });
const assemble = () =>
	new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);

async function setLevel(level: number) {
	await db.update(s.userCharacter).set({ combatLevel: level }).where(eq(s.userCharacter.discordId, id));
}

describe('class branch config', () => {
	it('offers exactly 2 branches per class with modest tilts', () => {
		for (const combatClass of ['Swordsman', 'Fighter', 'Mage', 'Knight', 'Archer']) {
			const defs = branchesForClass(combatClass);
			expect(defs).toHaveLength(2);
			for (const def of defs) {
				for (const value of Object.values(def.tilt)) {
					expect(Math.abs(value)).toBeLessThanOrEqual(0.12);
				}
			}
		}
		expect(branchesForClass('Necromancer')).toEqual([]);
	});
});

describe('branch service', () => {
	it('lists the class branches with the current mark', async () => {
		const result = await branch().list(id);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toContain('Guardian');
		expect(result.value).toContain('Crusader');
	});

	it('sets a branch at Lv.40+ and applies its tilt in assembly', async () => {
		await setLevel(40);
		expect((await branch().set(id, 'guardian')).ok).toBe(true);
		const [row] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(row.classBranch).toBe('guardian');
		const assembled = await assemble();
		expect(assembled.branch).toBe('guardian');
		// guardian: +10% DEF on base — compare against the unbranched assembly.
		await db.update(s.userCharacter).set({ classBranch: null }).where(eq(s.userCharacter.discordId, id));
		const plain = await assemble();
		expect(assembled.stats.def).toBeGreaterThan(plain.stats.def);
	});

	it('rejects unknown branches, wrong-class branches and low levels', async () => {
		expect(await branch().set(id, 'pyromancer')).toEqual(expect.objectContaining({ ok: false }));
		expect(await branch().set(id, 'bogus')).toEqual(expect.objectContaining({ ok: false }));
		expect(await branch().set(id, 'guardian')).toEqual(expect.objectContaining({ ok: false }));
		const [row] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(row.classBranch).toBeNull();
	});

	it('ignores a stale branch from another class after a class change', async () => {
		await setLevel(40);
		expect((await branch().set(id, 'guardian')).ok).toBe(true);
		// Simulate a class change leaving the old branch behind.
		await db
			.update(s.userCharacter)
			.set({ class: 'Mage' })
			.where(eq(s.userCharacter.discordId, id));
		const stale = await new StatAssemblyService(undefined, undefined, undefined, {
			persistence: testPersistence(),
		}).assemble(id, 'Mage', 1);
		await db.update(s.userCharacter).set({ classBranch: null }).where(eq(s.userCharacter.discordId, id));
		const clean = await new StatAssemblyService(undefined, undefined, undefined, {
			persistence: testPersistence(),
		}).assemble(id, 'Mage', 1);
		expect(stale.stats).toEqual(clean.stats);
	});

	it('returns not-registered for strangers', async () => {
		expect(await branch().list('ghost')).toEqual(expect.objectContaining({ ok: false }));
		expect(await branch().set('ghost', 'guardian')).toEqual(expect.objectContaining({ ok: false }));
	});
});
