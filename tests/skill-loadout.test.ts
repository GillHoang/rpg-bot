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
import { SkillService } from '../src/modules/progression/application/SkillService.js';
import { StatAssemblyService } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { PlayerCombatantFactory } from '../src/modules/combat-shared/application/combatantFactory.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';

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
	id = `skill-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
});

const skills = () => new SkillService({ persistence: testPersistence() });

describe('skill loadout service', () => {
	it('lists the class skills with equipped marks', async () => {
		const result = await skills().list(id);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toContain('Tuyệt kỹ');
		expect(result.value).toContain('Trừng Phạt');
		await skills().equip(id, 1, 'smite');
		const relisted = await skills().list(id);
		expect(relisted.ok && relisted.value).toContain('(ô 1)');
	});

	it('equips class skills, moves across slots and unequips', async () => {
		expect((await skills().equip(id, 1, 'smite')).ok).toBe(true);
		expect((await skills().equip(id, 2, 'rally')).ok).toBe(true);
		let [row] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(row.skillSlot1).toBe('smite');
		expect(row.skillSlot2).toBe('rally');
		// Moving smite to slot 2 clears slot 1 — one skill, one slot.
		expect((await skills().equip(id, 2, 'smite')).ok).toBe(true);
		[row] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(row.skillSlot1).toBeNull();
		expect(row.skillSlot2).toBe('smite');
		// Unequip with an empty key.
		expect((await skills().equip(id, 2, null)).ok).toBe(true);
		[row] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(row.skillSlot2).toBeNull();
	});

	it('rejects unknown skills, wrong-class skills and bad slots', async () => {
		expect(await skills().equip(id, 1, 'fireball')).toEqual(expect.objectContaining({ ok: false }));
		expect(await skills().equip(id, 1, 'nope')).toEqual(expect.objectContaining({ ok: false }));
		expect(await skills().equip(id, 3, 'smite')).toEqual(expect.objectContaining({ ok: false }));
		expect(await skills().equip(id, 0, 'smite')).toEqual(expect.objectContaining({ ok: false }));
		const [row] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(row.skillSlot1).toBeNull();
		expect(row.skillSlot2).toBeNull();
	});

	it('sets the battle order and rejects unknown stances', async () => {
		expect((await skills().setOrder(id, 'aggressive')).ok).toBe(true);
		const [row] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(row.battleOrder).toBe('aggressive');
		expect(await skills().setOrder(id, 'reckless')).toEqual(expect.objectContaining({ ok: false }));
	});

	it('returns not-registered for strangers', async () => {
		expect(await skills().list('ghost')).toEqual(expect.objectContaining({ ok: false }));
		expect(await skills().equip('ghost', 1, 'smite')).toEqual(expect.objectContaining({ ok: false }));
		expect(await skills().setOrder('ghost', 'balanced')).toEqual(expect.objectContaining({ ok: false }));
	});
});

describe('skill loadout reaches battle', () => {
	it('assembly carries skills, stance and branch; factory copies them', async () => {
		await skills().equip(id, 1, 'smite');
		await skills().equip(id, 2, 'rally');
		await skills().setOrder(id, 'defensive');
		const assembled = await new StatAssemblyService(undefined, undefined, undefined, {
			persistence: testPersistence(),
		}).assemble(id, 'Knight', 1);
		expect(assembled.skills).toEqual(['smite', 'rally']);
		expect(assembled.stance).toBe('defensive');
		expect(assembled.branch).toBeNull();
		// Knight identity still derived.
		expect(assembled.damageType).toBe('physical');
		expect(assembled.armorType).toBe('heavy');
		const combatant = new PlayerCombatantFactory().createCombatant(id, 'Knight', assembled);
		expect(combatant.skills).toEqual(['smite', 'rally']);
		expect(combatant.stance).toBe('defensive');
	});

	it('filters stale or wrong-class slots instead of crashing combat', async () => {
		// Stale skill keys stay readable in the row; assembly drops them.
		// (battle_order cannot go stale — the DB CHECK only allows 4 stances.)
		await db
			.update(s.userCharacter)
			.set({ skillSlot1: 'fireball', skillSlot2: 'bogus' })
			.where(eq(s.userCharacter.discordId, id));
		const assembled = await new StatAssemblyService(undefined, undefined, undefined, {
			persistence: testPersistence(),
		}).assemble(id, 'Knight', 1);
		expect(assembled.skills).toEqual([]);
		expect(assembled.stance).toBe('balanced');
	});
});
