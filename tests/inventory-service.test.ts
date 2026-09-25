import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Executor } from '../src/db/client.js';
import { createTestDatabase, migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import * as s from '../src/db/schema.js';

const defaultQuery = vi.hoisted(() =>
	vi.fn(() => {
		throw new Error('Default database must not be used');
	}),
);
vi.mock('../src/db/client.js', () => ({ db: { select: defaultQuery, transaction: defaultQuery }, pool: {} }));
import { InventoryService } from '../src/modules/progression/application/InventoryService.js';
import type { InventoryDataRepository } from '../src/modules/progression/infrastructure/InventoryDataRepository.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { RUNE_SEED } from '../src/modules/progression/seed/runes.js';
import { DEITY_SEED } from '../src/modules/progression/seed/deities.js';

let first: TestDatabase;
let second: TestDatabase;
let inventory: InventoryService;
let isolated: InventoryService;

beforeAll(async () => {
	first = createTestDatabase();
	second = createTestDatabase();
	await Promise.all([migrateTestDatabase(first.testClient), migrateTestDatabase(second.testClient)]);
	for (const [database, credux] of [
		[first, 100],
		[second, 900],
	] as const) {
		await database.db.insert(s.users).values([
			{ discordId: 'owner', username: 'Hero' },
			{ discordId: 'foreign', username: 'Other' },
		]);
		await database.db.insert(s.usersBag).values({ discordId: 'owner', credux });
	}
	const db = first.db;
	await db.insert(s.weaponRoster).values({ ...WEAPON_SEED[0], weaponRosterId: 1, name: 'Sword', tier: 'Common' });
	await db.insert(s.armorRoster).values({ ...ARMOR_SEED[0], armorRosterId: 1, name: 'Armor', tier: 'Common' });
	await db
		.insert(s.runeRoster)
		.values({ ...RUNE_SEED[0], runeId: 1, name: 'Rune', tier: 'Epic', lane: 'native', description: 'Rune effect' });
	await db
		.insert(s.deityRoster)
		.values({ ...DEITY_SEED[0], deityId: 1, name: 'Deity', tier: 'Epic', baseAtk: 101, baseHp: 1001, baseDef: 81 });
	const weapon = {
		discordId: 'owner',
		weaponRosterId: 1,
		currAtk: 150,
		baseAtk: 100,
		crit: 7.5,
		enhancement: 3,
		nativeSockets: [null, 'R02'],
		oppositeSockets: [null],
	};
	await db.insert(s.userWeapons).values([
		...Array.from({ length: 26 }, (_, index) => ({
			...weapon,
			weaponId: `W${String(26 - index).padStart(2, '0')}`,
		})),
		{ ...weapon, discordId: 'foreign', weaponId: 'W00' },
	]);
	const armor = {
		discordId: 'owner',
		armorRosterId: 1,
		currHp: 250,
		currDef: 75,
		baseHp: 100,
		baseDef: 50,
		enhancement: 2,
		nativeSockets: [null],
		oppositeSockets: ['R01'],
	};
	await db.insert(s.userArmors).values([
		{ ...armor, armorId: 'A01' },
		{ ...armor, discordId: 'foreign', armorId: 'A00' },
	]);
	await db.insert(s.userCharacter).values({ discordId: 'owner', class: 'Knight' });
	await db
		.insert(s.userPresets)
		.values({ discordId: 'owner', slot: 1, equippedWeaponId: 'W03', equippedArmorId: 'A01' });
	await db.insert(s.userRunes).values([
		{ discordId: 'owner', runeId: 1, runeUid: 'R01', socketedInto: 'W01' },
		{ discordId: 'owner', runeId: 1, runeUid: 'R03' },
		{ discordId: 'owner', runeId: 1, runeUid: 'R02' },
		{ discordId: 'foreign', runeId: 1, runeUid: 'R00' },
	]);
	const deity = {
		deityId: 1,
		currAtk: 9999,
		currHp: 9999,
		currDef: 9999,
		lastPullDate: '2026-09-21',
		sigils: 3,
		ascended: true,
	};
	await db.insert(s.userDeities).values([
		{ ...deity, discordId: 'owner', userDeityId: 7 },
		{ ...deity, discordId: 'foreign', userDeityId: 8 },
	]);
	inventory = new InventoryService(first.db as unknown as Executor);
	isolated = new InventoryService(second.db as unknown as Executor);
}, 120000);
afterAll(async () => {
	await Promise.all([first?.pool.end(), second?.pool.end()]);
});
afterEach(() => {
	expect(defaultQuery).not.toHaveBeenCalled();
});

describe('InventoryService projections and persistence isolation', () => {
	it('isolates injected databases without default reads', async () => {
		expect((await inventory.bag('owner'))?.credux).toBe(100);
		expect((await isolated.bag('owner'))?.credux).toBe(900);
		expect(await inventory.bag('missing')).toBeNull();
		expect(await inventory.count('owner', 'weapons')).toBe(26);
		expect(await isolated.count('owner', 'weapons')).toBe(0);
		expect(await isolated.list('owner', 'weapons', 1)).toEqual([]);
	});

	it('preserves 8-row ordering, page offsets and exact weapon/armor display', async () => {
		const firstPage = await inventory.list('owner', 'weapons', 1);
		expect(firstPage).toHaveLength(8);
		expect(firstPage[0]).toBe(
			'**Sword** (Common · Common) +2\nID: `W01` · ATK 150 · CRIT 7.5%\nSockets: [null,"R02"] / [null]',
		);
		expect(firstPage[7]).toContain('`W08`');
		const secondPage = await inventory.list('owner', 'weapons', 2);
		expect(secondPage).toHaveLength(8);
		expect(secondPage[0]).toContain('`W09`');
		expect((await inventory.list('owner', 'weapons', 4)).map((line) => line.match(/ID: `(.*?)`/)?.[1])).toEqual([
			'W25',
			'W26',
		]);
		expect(await inventory.list('owner', 'weapons', 5)).toEqual([]);
		expect(await inventory.list('owner', 'armors', 1)).toEqual([
			'**Armor** (Common) +1\nID: `A01` · HP 250 · DEF 75\nSockets: [null] / ["R01"]',
		]);
	});

	it('preserves rune ordering/socket text and computes deity stats from sigils rather than legacy values', async () => {
		expect(await inventory.list('owner', 'runes', 1)).toEqual([
			'**Rune** (Epic, native)\nID: `R01` · Rune effect\nGắn vào: W01',
			'**Rune** (Epic, native)\nID: `R02` · Rune effect\nGắn vào: chưa gắn',
			'**Rune** (Epic, native)\nID: `R03` · Rune effect\nGắn vào: chưa gắn',
		]);
		expect(await inventory.list('owner', 'deities', 1)).toEqual([
			'**Deity** (Epic) · ID: `7`\nSigil 3/10 · Ascended: Có (prestige)\nATK 65 · HP 650 · DEF 52',
		]);
		expect(await inventory.count('owner', 'armors')).toBe(1);
		expect(await inventory.count('owner', 'runes')).toBe(3);
		expect(await inventory.count('owner', 'deities')).toBe(1);
	});

	it('preserves autocomplete ownership, case-insensitive name/ID search, limits and equipped flags', async () => {
		const weapons = await inventory.searchWeapons('owner', 'sWoRd');
		expect(weapons).toHaveLength(25);
		expect(weapons[0]).toEqual({ id: 'W01', name: 'Sword', tier: 'Common', plus: 2, equipped: false });
		// Equipped means wielded by a deity now — preset links no longer count.
		expect(weapons.find((row) => row.id === 'W03')?.equipped).toBe(false);
		expect(await inventory.searchWeapons('owner', 'w26')).toEqual([
			{ id: 'W26', name: 'Sword', tier: 'Common', plus: 2, equipped: false },
		]);
		expect(await inventory.searchWeapons('owner', 'W00')).toEqual([]);
		expect(await inventory.searchArmors('owner', 'a01')).toEqual([
			{ id: 'A01', name: 'Armor', tier: 'Common', plus: 1, equipped: true },
		]);
		expect(await inventory.searchDeities('owner', '7')).toEqual([{ id: 7, name: 'Deity', tier: 'Epic' }]);
		expect(await inventory.searchDeities('owner', '8')).toEqual([]);
		expect((await inventory.searchRunes('owner', 'rUnE')).map((row) => [row.uid, row.socketedInto])).toEqual([
			['R02', null],
			['R03', null],
			['R01', 'W01'],
		]);
	});

	it('accepts structural data ports and forwards category offsets without accessing its executor', async () => {
		const data = {
			bag: vi.fn<InventoryDataRepository['bag']>().mockResolvedValue(null),
			count: vi.fn<InventoryDataRepository['count']>().mockResolvedValue(42),
			weapons: vi.fn<InventoryDataRepository['weapons']>().mockResolvedValue([]),
			armors: vi.fn<InventoryDataRepository['armors']>().mockResolvedValue([]),
			runes: vi.fn<InventoryDataRepository['runes']>().mockResolvedValue([]),
			deities: vi.fn<InventoryDataRepository['deities']>().mockResolvedValue([]),
			searchWeapons: vi.fn<InventoryDataRepository['searchWeapons']>().mockResolvedValue([]),
			searchArmors: vi.fn<InventoryDataRepository['searchArmors']>().mockResolvedValue([]),
			searchDeities: vi.fn<InventoryDataRepository['searchDeities']>().mockResolvedValue([]),
			searchRunes: vi.fn<InventoryDataRepository['searchRunes']>().mockResolvedValue([]),
		};
		const unusedExecutor = Object.freeze({
			select: () => {
				throw new Error('Explicit data port must be used');
			},
		}) as unknown as Executor;
		const service = new InventoryService(unusedExecutor, data);
		await service.list('player', 'weapons', 3);
		await service.list('player', 'armors', 2);
		await service.list('player', 'runes', 4);
		await service.list('player', 'deities', 1);
		expect(data.weapons).toHaveBeenCalledExactlyOnceWith('player', 16);
		expect(data.armors).toHaveBeenCalledExactlyOnceWith('player', 8);
		expect(data.runes).toHaveBeenCalledExactlyOnceWith('player', 24);
		expect(data.deities).toHaveBeenCalledExactlyOnceWith('player', 0);
		expect(await service.bag('player')).toBeNull();
		expect(await service.count('player', 'runes')).toBe(42);
	});
});
