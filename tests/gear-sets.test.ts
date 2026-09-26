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
import { StatAssemblyService } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { GearRepository } from '../src/modules/progression/infrastructure/GearRepository.js';
import { LoadoutService } from '../src/modules/progression/application/LoadoutService.js';
import { computeClassStats } from '../src/shared/config/classes.js';
import { applyGearSetBonus, gearSetBonusFor, type GearSetMods } from '../src/shared/config/gearSets.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';

let id: string;
let sequence = 0;
let grantSeq = 0;

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
	id = `gearset-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
});

const assemble = () =>
	new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(
		id,
		'Knight',
		1,
	);
const gear = () => new GearRepository();
const loadout = () => new LoadoutService({ persistence: testPersistence() });

async function grantAndEquip(weaponRosterId: number, armorRosterId: number) {
	const wid = `w-${weaponRosterId}-${++grantSeq}`;
	const aid = `a-${armorRosterId}-${grantSeq}`;
	const persistence = testPersistence();
	await persistence.unitOfWork.run(async (tx) => {
		await gear().grantWeapon(tx, { discordId: id, weaponId: wid, weaponRosterId, atk: 100, crit: 5 });
		await gear().grantArmor(tx, { discordId: id, armorId: aid, armorRosterId, hp: 500, def: 50 });
	});
	expect((await loadout().equip(id, 'weapon', wid)).ok).toBe(true);
	expect((await loadout().equip(id, 'armor', aid)).ok).toBe(true);
}

describe('gear set 2-piece bonus', () => {
	it('applies +8% ATK when weapon and armor share the bloodfang set', async () => {
		await grantAndEquip(101, 101); // both bloodfang (seed)
		const base = computeClassStats('Knight', 1).atk + 100; // quality Common ×1.0
		const assembled = await assemble();
		expect(assembled.stats.atk).toBe(Math.floor(base * 1.08));
	});

	it('grants nothing on mismatched sets or set-less starter gear', async () => {
		await grantAndEquip(101, 102); // bloodfang weapon + stoneward armor
		const mismatched = await assemble();
		const base = computeClassStats('Knight', 1).atk + 100;
		expect(mismatched.stats.atk).toBe(base);
	});

	it('leaves stoneward/swiftwind bonuses on their own stats', async () => {
		await grantAndEquip(102, 102); // stoneward pair: HP/DEF only
		const assembled = await assemble();
		const base = computeClassStats('Knight', 1).atk + 100;
		expect(assembled.stats.atk).toBe(base);
		expect(assembled.stats.hp).toBeGreaterThan(computeClassStats('Knight', 1).hp + 500);
	});
});

describe('applyGearSetBonus (pure)', () => {
	const mods = (): GearSetMods => ({ atkPct: 0, hpPct: 0, defPct: 0, critPts: 0, spdPct: 0, accPts: 0 });

	it('returns the matched key and sums the bonus once', () => {
		const m = mods();
		expect(applyGearSetBonus(m, 'bloodfang', 'bloodfang')).toBe('bloodfang');
		expect(m.atkPct).toBeCloseTo(0.08);
		expect(gearSetBonusFor('bloodfang')).toMatchObject({ atkPct: 0.08 });
	});

	it('returns null for null, mismatched or unknown sets without touching mods', () => {
		for (const [w, a] of [
			[null, null],
			['bloodfang', null],
			[null, 'bloodfang'],
			['bloodfang', 'stoneward'],
			['bogus', 'bogus'],
		] as const) {
			const m = mods();
			expect(applyGearSetBonus(m, w, a)).toBeNull();
			expect(m).toEqual(mods());
		}
	});
});
