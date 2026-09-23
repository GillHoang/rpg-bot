// Temporary review probes: assertions describe observed defects, not desired behavior.
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

let client: TestDatabase['testClient'];
beforeAll(async () => {
	client = (await import('../src/db/client.js') as unknown as TestDatabase).testClient;
	await migrateTestDatabase(client);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
	await db.insert(s.titleCatalog).values(TITLE_SEED);
	await db.insert(s.cosmeticCatalog).values(COSMETIC_SEED);
}, 30000);
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
	vi.restoreAllMocks();
	await client.exec('TRUNCATE users CASCADE');
	for (const id of ['audit-a', 'audit-b']) {
		expect((await new StartService().start(id, id, 'Knight')).status).toBe('ok');
	}
});

function forceBattle(outcome: 'player_win' | 'enemy_win' | 'draw') {
	vi.spyOn(BattleEngine.prototype, 'resolve').mockReturnValue({
		outcome, rounds: 1, log: [], roundLogs: [], playerHpRemaining: 1, enemyHpRemaining: 1,
	});
}
async function character(id: string) {
	return (await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id)))[0];
}

it('R1: database rejects the first level above 50 and rolls back the reward', async () => {
	expect(MAX_COMBAT_LEVEL).toBe(100);
	await db.update(s.userCharacter).set({ combatLevel: 50, combatExp: expRequiredForLevel(50) - 1 }).where(eq(s.userCharacter.discordId, 'audit-a'));
	let error: unknown;
	try {
		await db.transaction((tx) => new RaidRewardService().grant(tx as never, 'audit-a', {
			expGain: 1, credux: 100, shards: 0, grantChest: false, battleType: 'raid', enemyName: 'mob', enemyTier: 'regular', won: true,
		}));
	} catch (caught) { error = caught; }
	expect(String((error as { cause?: Error })?.cause ?? error)).toContain('character_valid_level');
	expect((await character('audit-a')).combatLevel).toBe(50);
});

it('R2: solar and tidal bonuses are 100 times smaller than their advertised percentages', () => {
	const self = createCombatant({ name: 'self', combatClass: null, hp: 100, atk: 10000, def: 0, crit: 0 });
	const enemy = createCombatant({ name: 'enemy', combatClass: null, hp: 100, atk: 1, def: 0, crit: 0 });
	const context = { self, enemy, round: 1, rng: () => 0.5, log: () => {} };
	const solar = { damagePctBonus: 0, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false };
	new DeityBlessingDecorator(new NullClassStrategy(), 'solar_fury', 1).prepareOutgoingHit(context, solar);
	expect(hitMultiplier(false, solar.damagePctBonus)).toBeCloseTo(1.0006);
	self.hp = 50;
	const tidal = { ...solar, damagePctBonus: 0 };
	new DeityBlessingDecorator(new NullClassStrategy(), 'tidal_wrath', 1).prepareOutgoingHit(context, tidal);
	expect(hitMultiplier(false, tidal.damagePctBonus)).toBeCloseTo(1.00175);
});

it('R3: tailwind accumulates instead of keeping a fixed initiative bonus', () => {
	const self = createCombatant({ name: 'self', combatClass: null, hp: 100, atk: 1, def: 0, crit: 0 });
	const enemy = createCombatant({ name: 'enemy', combatClass: null, hp: 100, atk: 1, def: 0, crit: 0 });
	const strategy = new DeityBlessingDecorator(new NullClassStrategy(), 'tailwind', 1);
	for (let round = 1; round <= 2; round++) strategy.onRoundStart({ self, enemy, round, rng: () => 0.5, log: () => {} });
	expect(self.flags.initiative_bias).toBe(0.5);
});

it('R4: a played ranked loss increments only the winners participation quest', async () => {
	forceBattle('enemy_win');
	for (const id of ['audit-a', 'audit-b']) {
		await db.insert(s.weeklyQuests).values({ discordId: id, questType: 'ranked', targetCount: 5, questWeek: weekWindowAt().key, rewardCredux: 100, rewardValor: 1 });
	}
	expect((await new RankedService().fight('audit-a')).status).toBe('ok');
	const quests = await db.select().from(s.weeklyQuests);
	expect(quests.find(q => q.discordId === 'audit-a' && q.questType === 'ranked')?.currentCount).toBe(0);
	expect(quests.find(q => q.discordId === 'audit-b' && q.questType === 'ranked')?.currentCount).toBe(1);
});

it('R5: a defending ranked winner is promoted without title or highest streak', async () => {
	forceBattle('enemy_win');
	await db.update(s.userCharacter).set({ pvpRating: 1099 });
	expect((await new RankedService().fight('audit-a')).status).toBe('ok');
	const defender = await character('audit-b');
	expect(defender.pvpRating).toBeGreaterThanOrEqual(1100);
	expect(defender.highestRankStreak).toBe(0);
	const titles = await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, 'audit-b'));
	expect(titles).toHaveLength(0);
});

it('R6: a prior ranked win prevents First Blood on the first duel victory', async () => {
	forceBattle('player_win');
	expect((await new RankedService().fight('audit-a')).status).toBe('ok');
	const duels = new DuelService();
	const created = await duels.create('audit-a', 'audit-b', 0);
	if (created.status !== 'ok') throw new Error(created.status);
	expect((await duels.accept(created.duelId, 'audit-b')).status).toBe('ok');
	const [firstBlood] = await db.select().from(s.titleCatalog).where(eq(s.titleCatalog.code, 'first_blood'));
	const titles = await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, 'audit-a'));
	expect(titles.some(t => t.titleId === firstBlood.titleId)).toBe(false);
});

it('R7: buying an already-earned title consumes medals but grants nothing', async () => {
	await db.update(s.usersBag).set({ valorMedals: 100 }).where(eq(s.usersBag.discordId, 'audit-a'));
	await db.transaction((tx) => new CosmeticService().grantTitleInTx(tx as never, 'audit-a', 'rank_champion'));
	expect(await new PvpShopService().buy('audit-a', 'title_champion')).toContain('Đã mua');
	const [bag] = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a'));
	expect(bag.valorMedals).toBe(20);
	expect(await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, 'audit-a'))).toHaveLength(1);
});

it('R8: a one-round battle reports two rounds', () => {
	const self = createCombatant({ name: 'self', combatClass: null, hp: 10000, atk: 10000, def: 0, crit: 0 });
	const enemy = createCombatant({ name: 'enemy', combatClass: null, hp: 1, atk: 0, def: 0, crit: 0 });
	const result = new BattleEngine().resolve(self, enemy, 42);
	expect(result.roundLogs).toHaveLength(1);
	expect(result.rounds).toBe(2);
});

it('R9: an expired duel participant still blocks creation with a unique violation', async () => {
	const duels = new DuelService();
	const created = await duels.create('audit-a', 'audit-b', 0);
	expect(created.status).toBe('ok');
	await db.update(s.activeDuels).set({ expiresAt: new Date(0) });
	await db.update(s.activeDuelParticipants).set({ expiresAt: new Date(0) });
	let error: unknown;
	try { await duels.create('audit-a', 'audit-b', 0); } catch (caught) { error = caught; }
	expect(String((error as { cause?: Error })?.cause ?? error)).toContain('duplicate key');
});
