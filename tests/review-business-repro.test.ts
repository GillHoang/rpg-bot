// Regression coverage for the 2026-09-23 business-logic review.
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/services/StartService.js';
import { RaidRewardService } from '../src/services/RaidRewardService.js';
import { RankedService } from '../src/services/RankedService.js';
import { DuelService } from '../src/services/DuelService.js';
import { PvpShopService } from '../src/services/PvpShopService.js';
import { CosmeticService } from '../src/services/CosmeticService.js';
import { BattleEngine } from '../src/domain/combat/BattleEngine.js';
import { createCombatant } from '../src/domain/combat/CombatantState.js';
import { NullClassStrategy } from '../src/domain/combat/classes/NullClassStrategy.js';
import { DeityBlessingDecorator } from '../src/domain/combat/DeityBlessingDecorator.js';
import { hitMultiplier } from '../src/domain/combat/DamageCalculator.js';
import { expRequiredForLevel, MAX_COMBAT_LEVEL } from '../src/config/combatExp.js';
import { WEAPON_SEED } from '../src/seed/data/weapons.js';
import { ARMOR_SEED } from '../src/seed/data/armors.js';
import { TITLE_SEED } from '../src/seed/data/titles.js';
import { COSMETIC_SEED } from '../src/seed/data/cosmetics.js';
import { weekWindowAt } from '../src/config/ranked.js';
import { RankedRepository } from '../src/repositories/RankedRepository.js';
import { DuelRepository } from '../src/repositories/DuelRepository.js';
import { PvpShopRepository } from '../src/repositories/PvpShopRepository.js';
import { BLESSINGS } from '../src/config/blessings.js';

let client: TestDatabase['testClient'];
beforeAll(async () => {
	client = ((await import('../src/db/client.js')) as unknown as TestDatabase).testClient;
	await migrateTestDatabase(client);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
	await db.insert(s.titleCatalog).values(TITLE_SEED);
	await db.insert(s.cosmeticCatalog).values(COSMETIC_SEED);
}, 30000);
afterAll(async () => {
	await pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	await client.exec('TRUNCATE users, raid_logs, active_duels CASCADE');
	for (const id of ['audit-a', 'audit-b']) {
		expect((await new StartService().start(id, id, 'Knight')).status).toBe('ok');
	}
});

function forceBattle(outcome: 'player_win' | 'enemy_win' | 'draw') {
	vi.spyOn(BattleEngine.prototype, 'resolve').mockReturnValue({
		outcome,
		rounds: 1,
		log: [],
		roundLogs: [],
		playerHpRemaining: 1,
		enemyHpRemaining: 1,
	});
}
async function character(id: string) {
	return (await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id)))[0];
}

it('R1: level 50 can advance to 51 and commit its reward', async () => {
	expect(MAX_COMBAT_LEVEL).toBe(100);
	await db
		.update(s.userCharacter)
		.set({ combatLevel: 50, combatExp: expRequiredForLevel(50) - 1 })
		.where(eq(s.userCharacter.discordId, 'audit-a'));
	let error: unknown;
	try {
		await db.transaction((tx) =>
			new RaidRewardService().grant(tx as never, 'audit-a', {
				expGain: 1,
				credux: 100,
				shards: 0,
				grantChest: false,
				battleType: 'raid',
				enemyName: 'mob',
				enemyTier: 'regular',
				outcome: 'player_win',
			}),
		);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeUndefined();
	expect((await character('audit-a')).combatLevel).toBe(51);
});

it('R2: solar and tidal bonuses match their advertised percentages', () => {
	const self = createCombatant({ name: 'self', combatClass: null, hp: 100, atk: 10000, def: 0, crit: 0 });
	const enemy = createCombatant({ name: 'enemy', combatClass: null, hp: 100, atk: 1, def: 0, crit: 0 });
	const context = { self, enemy, round: 1, rng: () => 0.5, log: () => {} };
	const solar = { damagePctBonus: 0, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false };
	new DeityBlessingDecorator(new NullClassStrategy(), 'solar_fury', 1).prepareOutgoingHit(context, solar);
	expect(hitMultiplier(false, solar.damagePctBonus)).toBeCloseTo(1.06);
	self.hp = 50;
	const tidal = { ...solar, damagePctBonus: 0 };
	new DeityBlessingDecorator(new NullClassStrategy(), 'tidal_wrath', 1).prepareOutgoingHit(context, tidal);
	expect(hitMultiplier(false, tidal.damagePctBonus)).toBeCloseTo(1.175);
});

it('R3: tailwind keeps a fixed initiative bonus across rounds', () => {
	const self = createCombatant({ name: 'self', combatClass: null, hp: 100, atk: 1, def: 0, crit: 0 });
	const enemy = createCombatant({ name: 'enemy', combatClass: null, hp: 100, atk: 1, def: 0, crit: 0 });
	const strategy = new DeityBlessingDecorator(new NullClassStrategy(), 'tailwind', 1);
	for (let round = 1; round <= 2; round++)
		strategy.onRoundStart({ self, enemy, round, rng: () => 0.5, log: () => {} });
	expect(self.flags.initiative_bias).toBe(0.25);
});

it.each(['player_win', 'enemy_win', 'draw'] as const)(
	'R4: ranked %s counts participation once and awards reputation only to the winner',
	async (outcome) => {
		forceBattle(outcome);
		for (const id of ['audit-a', 'audit-b']) {
			await db
				.insert(s.weeklyQuests)
				.values({
					discordId: id,
					questType: 'ranked',
					targetCount: 5,
					questWeek: weekWindowAt().key,
					rewardCredux: 100,
					rewardValor: 1,
				});
		}
		expect((await new RankedService().fight('audit-a')).status).toBe('ok');
		const quests = await db.select().from(s.weeklyQuests);
		expect(quests.find((q) => q.discordId === 'audit-a' && q.questType === 'ranked')?.currentCount).toBe(1);
		expect(quests.find((q) => q.discordId === 'audit-b' && q.questType === 'ranked')?.currentCount).toBe(0);
		expect((await character('audit-a')).believerExp).toBe(outcome === 'player_win' ? 50 : 0);
		expect((await character('audit-b')).believerExp).toBe(outcome === 'enemy_win' ? 50 : 0);
	},
);

it('R5: a defending ranked winner receives promotion title and highest streak', async () => {
	forceBattle('enemy_win');
	await db.update(s.userCharacter).set({ pvpRating: 1099 });
	expect((await new RankedService().fight('audit-a')).status).toBe('ok');
	const defender = await character('audit-b');
	expect(defender.pvpRating).toBeGreaterThanOrEqual(1100);
	expect(defender.highestRankStreak).toBe(1);
	const titles = await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, 'audit-b'));
	expect(titles).toHaveLength(1);
});

it('R6: first duel victory grants First Blood even after a ranked win', async () => {
	forceBattle('player_win');
	expect((await new RankedService().fight('audit-a')).status).toBe('ok');
	const duels = new DuelService();
	const created = await duels.create('audit-a', 'audit-b', 0);
	if (created.status !== 'ok') throw new Error(created.status);
	expect((await duels.accept(created.duelId, 'audit-b')).status).toBe('ok');
	const [firstBlood] = await db.select().from(s.titleCatalog).where(eq(s.titleCatalog.code, 'first_blood'));
	const titles = await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, 'audit-a'));
	expect(titles.some((t) => t.titleId === firstBlood.titleId)).toBe(true);
	const second = await duels.create('audit-a', 'audit-b', 0);
	if (second.status !== 'ok') throw new Error(second.status);
	await duels.accept(second.duelId, 'audit-b');
	expect(await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, 'audit-a'))).toHaveLength(
		titles.length,
	);
});

it('R7: buying an already-earned title consumes neither medals nor purchase quota', async () => {
	await db.update(s.usersBag).set({ valorMedals: 100 }).where(eq(s.usersBag.discordId, 'audit-a'));
	await db.transaction((tx) => new CosmeticService().grantTitleInTx(tx as never, 'audit-a', 'rank_champion'));
	expect(await new PvpShopService().buy('audit-a', 'title_champion')).toContain('đã sở hữu');
	const [bag] = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a'));
	expect(bag.valorMedals).toBe(100);
	expect(await db.select().from(s.pvpShopPurchases)).toHaveLength(0);
	expect(await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, 'audit-a'))).toHaveLength(1);
});

it('R8: a one-round battle reports one round', () => {
	const self = createCombatant({ name: 'self', combatClass: null, hp: 10000, atk: 10000, def: 0, crit: 0 });
	const enemy = createCombatant({ name: 'enemy', combatClass: null, hp: 1, atk: 0, def: 0, crit: 0 });
	const result = new BattleEngine().resolve(self, enemy, 42);
	expect(result.roundLogs).toHaveLength(1);
	expect(result.rounds).toBe(1);
});

it('R9: expired duel participants are released before the next duel', async () => {
	const duels = new DuelService();
	const created = await duels.create('audit-a', 'audit-b', 0);
	expect(created.status).toBe('ok');
	await db.update(s.activeDuels).set({ expiresAt: new Date(0) });
	await db.update(s.activeDuelParticipants).set({ expiresAt: new Date(0) });
	expect((await duels.create('audit-a', 'audit-b', 0)).status).toBe('ok');
	expect(await db.select().from(s.activeDuels)).toHaveLength(1);
});

it('R10: a 51-win raid streak is not truncated', async () => {
	await db.insert(s.raidLogs).values(
		Array.from({ length: 51 }, () => ({
			discordId: 'audit-a',
			battleType: 'raid',
			enemyName: 'mob',
			enemyTier: 'regular',
			result: 'win',
			updatedExp: 0,
			updatedBeliefShards: 0,
			updatedCredux: 0,
		})),
	);
	expect(await new RaidRewardService().currentWinStreak(db, 'audit-a')).toBe(51);
	await db
		.insert(s.raidLogs)
		.values({
			discordId: 'audit-a',
			battleType: 'raid',
			enemyName: 'mob',
			enemyTier: 'regular',
			result: 'loss',
			updatedExp: 0,
			updatedBeliefShards: 0,
			updatedCredux: 0,
		});
	expect(await new RaidRewardService().currentWinStreak(db, 'audit-a')).toBe(0);
});

it('R11: database stores the full level-100 EXP curve without overflow', async () => {
	let total = 0;
	let firstOverflowLevel = 0;
	for (let level = 1; level < MAX_COMBAT_LEVEL; level++) {
		total += expRequiredForLevel(level);
		if (!firstOverflowLevel && total > 2_147_483_647) firstOverflowLevel = level + 1;
	}
	expect(total).toBe(3_630_601_650);
	expect(firstOverflowLevel).toBe(82);
	let error: unknown;
	try {
		await db.update(s.userCharacter).set({ lifetimeExp: total }).where(eq(s.userCharacter.discordId, 'audit-a'));
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeUndefined();
	expect((await character('audit-a')).lifetimeExp).toBe(total);
});

it('R2: damage bonuses use the configured fraction and compose with class bonuses', () => {
	const original = BLESSINGS.solar_fury.value;
	try {
		Object.assign(BLESSINGS.solar_fury, { value: 0.12 });
		const self = createCombatant({ name: 'self', combatClass: null, hp: 100, atk: 100, def: 0, crit: 0 });
		const hit = { damagePctBonus: 30, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false };
		new DeityBlessingDecorator(new NullClassStrategy(), 'solar_fury', 0.5).prepareOutgoingHit(
			{ self, enemy: self, round: 1, rng: () => 0.5, log: () => {} },
			hit,
		);
		expect(hitMultiplier(false, hit.damagePctBonus)).toBeCloseTo(1.36);
	} finally {
		Object.assign(BLESSINGS.solar_fury, { value: original });
	}
});

it('R3: tailwind preserves other initiative bonuses and works for a new combatant', () => {
	const strategy = new DeityBlessingDecorator(new NullClassStrategy(), 'tailwind', 0.5);
	for (let fight = 0; fight < 2; fight++) {
		const self = createCombatant({ name: 'self', combatClass: null, hp: 100, atk: 1, def: 0, crit: 0 });
		self.flags.initiative_bias = 0.1;
		for (let round = 1; round <= 40; round++)
			strategy.onRoundStart({ self, enemy: self, round, rng: () => 0.5, log: () => {} });
		expect(self.flags.initiative_bias).toBeCloseTo(0.225);
	}
});

it('R7: an owned cosmetic cannot consume a new seasons purchase quota', async () => {
	await db.update(s.usersBag).set({ valorMedals: 100 }).where(eq(s.usersBag.discordId, 'audit-a'));
	await db.update(s.userCharacter).set({ believerLevel: 10 }).where(eq(s.userCharacter.discordId, 'audit-a'));
	const shop = new PvpShopService();
	expect(await shop.buy('audit-a', 'frame_gold')).toContain('Đã mua');
	await db.delete(s.pvpShopPurchases);
	expect(await shop.buy('audit-a', 'frame_gold')).toContain('đã sở hữu');
	const [bag] = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a'));
	expect(bag.valorMedals).toBe(60);
	expect(await db.select().from(s.pvpShopPurchases)).toHaveLength(0);
});

it('R7: a failure after granting ownership rolls back ownership, currency and quota', async () => {
	await db.update(s.usersBag).set({ valorMedals: 100 }).where(eq(s.usersBag.discordId, 'audit-a'));
	const queries = new PvpShopRepository();
	vi.spyOn(queries, 'updateBag').mockRejectedValueOnce(new Error('test write failure'));
	await expect(new PvpShopService(undefined, { queries }).buy('audit-a', 'title_champion')).rejects.toThrow(
		'test write failure',
	);
	expect(await db.select().from(s.userTitles)).toHaveLength(0);
	expect(await db.select().from(s.pvpShopPurchases)).toHaveLength(0);
	expect((await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a')))[0].valorMedals).toBe(100);
});

it('R9: a participant claimed between guard and insert returns busy and releases partial claims', async () => {
	const queries = new DuelRepository();
	const insert = queries.createParticipants.bind(queries);
	vi.spyOn(queries, 'createParticipants').mockImplementationOnce(async (tx, rows) => {
		// Simulate the conflicting claim visible at insert, after both guards passed.
		await queries.createDuel(tx, {
			duelId: 'competing',
			lockToken: 'competing',
			challengerId: 'audit-b',
			opponentId: 'other',
			duelType: 'casual',
			stake: 0,
			status: 'pending',
			expiresAt: new Date(Date.now() + 60000),
		});
		await insert(tx, [
			{
				discordId: 'audit-b',
				duelId: 'competing',
				lockToken: 'competing',
				role: 'challenger',
				expiresAt: new Date(Date.now() + 60000),
			},
		]);
		return insert(tx, rows);
	});
	expect(
		await new DuelService(undefined, undefined, undefined, undefined, undefined, { queries }).create(
			'audit-a',
			'audit-b',
			0,
		),
	).toEqual({ status: 'busy', who: 'opponent' });
	expect((await db.select().from(s.activeDuels)).map((d) => d.duelId)).toEqual(['competing']);
	expect((await db.select().from(s.activeDuelParticipants)).map((p) => p.discordId)).toEqual(['audit-b']);
});

it('R10: ranked streaks exceed 50, stop at draws and isolate each player', async () => {
	const queries = new RankedRepository();
	const row = { playerId: 'audit-a', opponentId: 'audit-b', result: 'win', ratingBefore: 1000, ratingAfter: 1016 };
	expect(await queries.currentWinStreak(db, 'audit-a')).toBe(0);
	await db.insert(s.rankedLogs).values(Array.from({ length: 51 }, () => row));
	expect(await queries.currentWinStreak(db, 'audit-a')).toBe(51);
	await db.insert(s.rankedLogs).values({ ...row, result: 'draw' });
	expect(await queries.currentWinStreak(db, 'audit-a')).toBe(0);
	await db.insert(s.rankedLogs).values(row);
	await db.insert(s.rankedLogs).values({ ...row, playerId: 'audit-b', result: 'loss' });
	expect(await queries.currentWinStreak(db, 'audit-a')).toBe(1);
	expect(await queries.currentWinStreak(db, 'audit-b')).toBe(0);
});

it('R1/R11: reaching the cap and receiving more EXP commits without integer overflow', async () => {
	await db
		.update(s.userCharacter)
		.set({ combatLevel: 99, combatExp: expRequiredForLevel(99) - 1, lifetimeExp: 3_630_601_649 })
		.where(eq(s.userCharacter.discordId, 'audit-a'));
	const grant = (expGain: number) =>
		db.transaction((tx) =>
			new RaidRewardService().grant(tx as never, 'audit-a', {
				expGain,
				credux: 100,
				shards: 0,
				grantChest: false,
				battleType: 'raid',
				enemyName: 'mob',
				enemyTier: 'regular',
				outcome: 'player_win',
			}),
		);
	await grant(1);
	expect((await character('audit-a')).combatLevel).toBe(100);
	// Legacy within-level EXP at the cap must remain writable as it grows.
	await db.update(s.userCharacter).set({ combatExp: 2_147_483_647 }).where(eq(s.userCharacter.discordId, 'audit-a'));
	await grant(1);
	expect((await character('audit-a')).combatExp).toBe(2_147_483_648);
	expect((await character('audit-a')).lifetimeExp).toBe(3_630_601_651);
	expect((await db.select().from(s.raidLogs)).at(-1)?.updatedExp).toBe(2_147_483_648);
});
