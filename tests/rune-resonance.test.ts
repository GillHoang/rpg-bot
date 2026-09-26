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
import { StatAssemblyService, applyRuneResonance } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { RUNE_SEED } from '../src/modules/progression/seed/runes.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import type { GearSetMods } from '../src/shared/config/gearSets.js';

let id: string;
let sequence = 0;
let starter!: { weaponId: string; armorId: string };

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.runeRoster).values(RUNE_SEED.map((r, i) => ({ ...r, runeId: i + 1 })));
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
}, 120000);
afterAll(async () => {
	await pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `rune-res-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
	starter = started;
});

const assemble = () =>
	new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);

// RUNE_SEED order → runeId: 1 sharpness (offense), 2 precision (offense), 5 vampiric (offense).
async function socketOffense(count: number) {
	for (let i = 0; i < count; i++) {
		const runeId = [1, 2, 5][i]!;
		await db.insert(s.userRunes).values({
			discordId: id,
			runeUid: `${id}-off-${i}`,
			runeId,
			socketedInto: i % 2 === 0 ? starter.weaponId : starter.armorId,
		});
	}
}

describe('rune resonance (Phase 3)', () => {
	it('fires offense resonance at 3 sockets with +6% ATK', async () => {
		const before = await assemble();
		expect(before.runeResonance).toEqual([]);
		await socketOffense(3);
		const after = await assemble();
		expect(after.runeResonance).toEqual(['offense']);
		expect(after.stats.atk).toBeGreaterThan(before.stats.atk);
	});

	it('stays silent below the threshold', async () => {
		await socketOffense(2);
		const assembled = await assemble();
		expect(assembled.runeResonance).toEqual([]);
	});
});

describe('applyRuneResonance (pure)', () => {
	const mods = (): GearSetMods => ({ atkPct: 0, hpPct: 0, defPct: 0, critPts: 0, spdPct: 0, accPts: 0 });

	it('triggers each family once at 3+ and sums with existing mods', () => {
		const m = mods();
		m.atkPct = 0.05;
		const fired = applyRuneResonance(m, [
			{ effectKey: 'sharpness' },
			{ effectKey: 'precision' },
			{ effectKey: 'vampiric' },
			{ effectKey: 'vitality' },
			{ effectKey: 'bulwark' },
		]);
		expect(fired).toEqual(['offense']);
		expect(m.atkPct).toBeCloseTo(0.11);
		expect(m.hpPct).toBe(0);
	});

	it('ignores unknown keys and fires multiple families independently', () => {
		const m = mods();
		const fired = applyRuneResonance(m, [
			{ effectKey: 'thorns' },
			{ effectKey: 'warding' },
			{ effectKey: 'aegis_rune' },
			{ effectKey: 'swiftness' },
			{ effectKey: 'eagle-eye' },
			{ effectKey: 'frost' },
			{ effectKey: 'bogus' },
		]);
		expect(fired).toEqual(['defense', 'mystic']);
		expect(m.hpPct).toBeCloseTo(0.06);
		expect(m.spdPct).toBeCloseTo(0.06);
		expect(m.atkPct).toBe(0);
	});
});
