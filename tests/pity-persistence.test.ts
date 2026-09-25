import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { testPersistence } from './helpers/persistence.js';
import { eq } from 'drizzle-orm';

// Regression: pity math was covered purely, but no test ever read
// pity_counters back after a real shard pull — deleting the upsertPity call
// kept the suite green. These tests pin DB-level persistence.
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { RunSummonUseCase } from '../src/modules/progression/application/RunSummonUseCase.js';
import * as rngModule from '../src/modules/combat-shared/domain/Rng.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { RUNE_SEED } from '../src/modules/progression/seed/runes.js';
import { DEITY_SEED } from '../src/modules/progression/seed/deities.js';
import { MOB_SEED } from '../src/modules/pve/seed/mobs.js';
import { ESSENCE_BAG_DEF_SEED, SOCKET_UNLOCK_COST_SEED } from '../src/modules/progression/seed/runeEconomy.js';
import { COSMETIC_SEED } from '../src/modules/meta/seed/cosmetics.js';
import { TITLE_SEED } from '../src/modules/meta/seed/titles.js';
import { RANKED_REWARD_SEED } from '../src/modules/pvp/seed/rankedRewards.js';

let sequence = 0;
let id: string;

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
	await db.insert(s.runeRoster).values(RUNE_SEED.map((r, i) => ({ ...r, runeId: i + 1 })));
	await db.insert(s.deityRoster).values(DEITY_SEED);
	await db.insert(s.mobRoster).values(MOB_SEED);
	await db.insert(s.essenceBagDef).values(ESSENCE_BAG_DEF_SEED);
	await db.insert(s.cosmeticCatalog).values(COSMETIC_SEED.map((c) => ({ ...c, isActive: true })));
	await db.insert(s.titleCatalog).values(TITLE_SEED);
	await db.insert(s.socketUnlockCost).values(SOCKET_UNLOCK_COST_SEED);
	await db.insert(s.rankedReward).values(RANKED_REWARD_SEED);
}, 120000);
afterAll(async () => {
	await pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `pity-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
	// rng() === 0 always rolls the first tier bucket (Epic) and the first
	// roster row — every pull is a plain Epic, so pity must climb by exactly
	// the pull count.
	vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
});

const pityCount = async () =>
	(await db.select().from(s.pityCounters).where(eq(s.pityCounters.discordId, id)))[0]?.pityCount;

describe('pity counter persistence', () => {
	it('writes pityAfter to pity_counters after ordinary shard pulls', async () => {
		const summon = new RunSummonUseCase(undefined, undefined, undefined, {
			persistence: testPersistence(),
		});
		const first = await summon.run(id, 5);
		expect(first.status).toBe('ok');
		if (first.status !== 'ok') throw new Error('unreachable');
		expect(first.finalPity).toBe(5);
		expect(await pityCount()).toBe(5);

		const second = await summon.run(id, 3);
		expect(second.status).toBe('ok');
		if (second.status !== 'ok') throw new Error('unreachable');
		expect(second.finalPity).toBe(8);
		expect(await pityCount()).toBe(8);
	});

	it('forces Legendary at 500 and resets the persisted counter', async () => {
		await db.update(s.pityCounters).set({ pityCount: 499 }).where(eq(s.pityCounters.discordId, id));
		const result = await new RunSummonUseCase(undefined, undefined, undefined, {
			persistence: testPersistence(),
		}).run(id, 1);
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.finalPity).toBe(0);
		expect(result.pulls).toHaveLength(1);
		expect(result.pulls[0].tier).toBe('Legendary');
		expect(await pityCount()).toBe(0);
	});

	it('leaves pity untouched on relic pulls', async () => {
		await db.update(s.usersBag).set({ sacredRelics: 2 }).where(eq(s.usersBag.discordId, id));
		const before = (await pityCount()) ?? 0;
		const result = await new RunSummonUseCase(undefined, undefined, undefined, {
			persistence: testPersistence(),
		}).run(id, 1, 'sacred');
		expect(result.status).toBe('ok');
		expect(await pityCount()).toBe(before);
	});
});
