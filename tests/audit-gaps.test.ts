import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { testPersistence } from './helpers/persistence.js';
import { eq } from 'drizzle-orm';

// Pins for the smaller casino/pvp gaps: baccarat third-card matrix, slots
// RTP identity, blackjack natural 1:1 policy, expired-session recovery
// isolation, and ranked shield/floor service integration.
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { RankedService } from '../src/modules/pvp/application/RankedService.js';
import { RaidService } from '../src/modules/pve/application/RaidService.js';
import { CasinoSessionService } from '../src/modules/casino/application/CasinoSessionService.js';
import { bankerDrawsThird } from '../src/modules/casino/domain/games/BaccaratGame.js';
import { BlackjackSession } from '../src/modules/casino/domain/BlackjackSession.js';
import { isBlackjack } from '../src/modules/casino/domain/CardDeck.js';
import { LootGrantService } from '../src/modules/economy/application/LootGrantService.js';
import { AppError } from '../src/shared/kernel/Result.js';
import { SLOT_LADDER, EVEN_MONEY } from '../src/shared/config/casinoPayouts.js';
import { createRng } from '../src/modules/combat-shared/domain/Rng.js';
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
	id = `gap-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
});

describe('baccarat third-card matrix', () => {
	const cases: Array<[number, number | null, boolean]> = [
		// Banker 0-2 always draws, 7+ never draws.
		[0, null, true],
		[1, 8, true],
		[2, 0, true],
		[7, null, false],
		[7, 6, false],
		// Banker 3 stands only on player third-card 8.
		[3, null, true],
		[3, 7, true],
		[3, 8, false],
		[3, 9, true],
		// Banker 4 draws on 2-7.
		[4, null, true],
		[4, 1, false],
		[4, 2, true],
		[4, 7, true],
		[4, 8, false],
		// Banker 5 draws on 4-7.
		[5, null, true],
		[5, 3, false],
		[5, 4, true],
		[5, 7, true],
		[5, 8, false],
		// Banker 6 draws on 6-7.
		[6, null, false],
		[6, 5, false],
		[6, 6, true],
		[6, 7, true],
		[6, 0, false],
	];
	it.each(cases)('banker %i vs player third %s draws=%s', (bTwo, pt, expected) => {
		expect(bankerDrawsThird(bTwo, pt)).toBe(expected);
	});
});

describe('slots RTP identity', () => {
	it('sums to exactly 1.0 (the stated 100% RTP)', () => {
		const rtp = SLOT_LADDER.reduce((sum, r) => sum + (r.prob / 100) * r.mult, 0);
		expect(rtp).toBeCloseTo(1, 9);
		const blankPct = 100 - SLOT_LADDER.reduce((sum, r) => sum + r.prob, 0);
		expect(blankPct).toBeGreaterThan(0);
	});
});

describe('blackjack natural payout policy', () => {
	const findDeal = (want: 'player' | 'dealer' | 'both'): number => {
		for (let seed = 1; seed <= 50000; seed++) {
			const shoe = BlackjackSession.create(100, createRng(seed));
			const p = isBlackjack(shoe.player);
			const d = isBlackjack(shoe.dealer);
			if (want === 'player' && p && !d) return seed;
			if (want === 'dealer' && !p && d) return seed;
			if (want === 'both' && p && d) return seed;
		}
		throw new Error(`no ${want}-natural seed found`);
	};

	it('pays a player natural exactly 1:1 (EVEN_MONEY), not 3:2', () => {
		const shoe = BlackjackSession.create(100, createRng(findDeal('player')));
		expect(shoe.state).toBe('done');
		expect(shoe.outcome).toBe('win');
		expect(shoe.payout).toBe(Math.floor(100 * EVEN_MONEY));
		expect(shoe.payout).toBe(200);
	});

	it('resolves a dealer natural immediately as a loss and a double natural as a push', () => {
		const loss = BlackjackSession.create(100, createRng(findDeal('dealer')));
		expect(loss.state).toBe('done');
		expect(loss.outcome).toBe('loss');
		expect(loss.payout).toBe(0);
		const push = BlackjackSession.create(100, createRng(findDeal('both')));
		expect(push.state).toBe('done');
		expect(push.outcome).toBe('push');
		expect(push.payout).toBe(100);
	});
});

describe('recoverExpired isolates poisoned sessions', () => {	it('settles the healthy session even when another expired row is corrupt', async () => {
		await db.update(s.usersBag).set({ credux: 900 }).where(eq(s.usersBag.discordId, id));
		const past = new Date(Date.now() - 5000);
		await db.insert(s.activeCasinoSessions).values({
			sessionId: 'gap-good',
			discordId: id,
			game: 'crash',
			status: 'active',
			betAmount: 100,
			balanceBefore: 1000,
			balanceAfterDebit: 900,
			stateJson: { seed: 7, actions: [] },
			expiresAt: past,
		});
		await db.insert(s.activeCasinoSessions).values({
			sessionId: 'gap-bad',
			discordId: id,
			game: 'crash',
			status: 'active',
			betAmount: 100,
			balanceBefore: 1000,
			balanceAfterDebit: 900,
			// Corrupt replay log: must throw inside act(), never block the sweep.
			stateJson: { seed: 7, actions: null },
			expiresAt: past,
		});
		await new CasinoSessionService({ persistence: testPersistence() }).recoverExpired();
		const [good] = await db
			.select()
			.from(s.activeCasinoSessions)
			.where(eq(s.activeCasinoSessions.sessionId, 'gap-good'));
		expect(good.status).toBe('settled');
		// Timeout with zero pushes cashes out at 1.0x: the debited 100 returns.
		expect(good.payout).toBe(100);
		expect((await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0].credux).toBe(1000);
		expect(await db.select().from(s.casinoLogs).where(eq(s.casinoLogs.discordId, id))).toHaveLength(1);
		const [bad] = await db
			.select()
			.from(s.activeCasinoSessions)
			.where(eq(s.activeCasinoSessions.sessionId, 'gap-bad'));
		expect(bad.status).toBe('active');
	});
});

describe('ranked shield and floor service integration', () => {
	const losingEngine = {
		resolve: () => ({
			outcome: 'enemy_win' as const,
			rounds: 3,
			log: [],
			roundLogs: [],
			playerHpRemaining: 0,
			enemyHpRemaining: 100,
		}),
	};

	const startFoe = async () => {
		const foe = `${id}-foe`;
		const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
			persistence: testPersistence(),
		}).start(foe, foe, 'Mage');
		if (started.status !== 'ok') throw new Error(started.status);
		return foe;
	};

	it('consumes the demotion shield to hold the bracket floor', async () => {
		const foe = await startFoe();
		await db.update(s.userCharacter).set({ pvpRating: 1100, pvpDemotionShield: true }).where(eq(s.userCharacter.discordId, id));
		await db.update(s.userCharacter).set({ pvpRating: 1500 }).where(eq(s.userCharacter.discordId, foe));
		const ranked = new RankedService(undefined, undefined, undefined, undefined, {
			persistence: testPersistence(),
			engine: losingEngine,
		});
		const fight = await ranked.fight(id);
		expect(fight.status).toBe('ok');
		if (fight.status !== 'ok') throw new Error('unreachable');
		expect(fight.shieldUsed).toBe(true);
		const [me] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(me.pvpRating).toBe(1100);
		expect(me.pvpDemotionShield).toBe(false);
		expect(me.rankedLosses).toBe(1);
	});

	it('floors the loser at zero while the winner still gains (documented inflation)', async () => {
		const foe = await startFoe();
		await db.update(s.userCharacter).set({ pvpRating: 0 }).where(eq(s.userCharacter.discordId, id));
		await db.update(s.userCharacter).set({ pvpRating: 1500 }).where(eq(s.userCharacter.discordId, foe));
		const ranked = new RankedService(undefined, undefined, undefined, undefined, {
			persistence: testPersistence(),
			engine: losingEngine,
		});
		const fight = await ranked.fight(id);
		expect(fight.status).toBe('ok');
		if (fight.status !== 'ok') throw new Error('unreachable');
		expect(fight.won).toBe(false);
		const [me] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(me.pvpRating).toBe(0);
		// Whoever the mirror match pulled in still banks the win bonus.
		const [winner] = await db
			.select()
			.from(s.userCharacter)
			.where(eq(s.userCharacter.discordId, fight.opponentId));
		expect(winner.pvpRating).toBeGreaterThanOrEqual(1001);
	});
});

describe('rune grant empty pool', () => {
	it('fails closed with LOOT_EMPTY_POOL instead of a plain choose() error', async () => {
		const grants = new LootGrantService({ findRunePool: async () => [] } as never);
		const error = await grants.rune({} as never, id, () => 0.5, { tier: 'Mythic' }).catch((e) => e);
		expect(error).toBeInstanceOf(AppError);
		expect((error as AppError).code).toBe('LOOT_EMPTY_POOL');
	});
});

describe('configurable raid cooldowns', () => {
	it('hunts on a 2s lockout and bosses on a 15m rolling window when overridden', async () => {
		let now = new Date();
		const raid = new RaidService({
			persistence: testPersistence(),
			clock: { now: () => now },
			cooldowns: { huntSeconds: 2, bossMinutes: 15 },
		});
		expect((await raid.run(id)).status).toBe('ok');
		// Anchor on the STORED readyAt (immune to DB/reader TZ skew): the
		// 2s window is proven by locked-just-before / open-just-after.
		const [cd] = await db.select().from(s.huntCooldowns).where(eq(s.huntCooldowns.discordId, id));
		now = new Date(cd.readyAt.getTime() - 1000);
		const immediate = await raid.run(id);
		expect(immediate.status).toBe('cooldown');
		if (immediate.status !== 'cooldown') throw new Error('unreachable');
		expect(immediate.retryAt.getTime()).toBe(cd.readyAt.getTime());
		now = new Date(cd.readyAt.getTime() + 1000);
		expect((await raid.run(id)).status).toBe('ok');
	});

	it('boss re-fight opens up after the rolling window elapses', async () => {
		// Real start time: raid_logs timestamps come from the database clock,
		// so the fake battle clock must start there too, not at a fixed date.
		let now = new Date();
		const raid = new RaidService({
			persistence: testPersistence(),
			clock: { now: () => now },
			cooldowns: { bossMinutes: 15 },
		});
		await db.update(s.userCharacter).set({ combatLevel: 10 }).where(eq(s.userCharacter.discordId, id));
		await db.update(s.usersBag).set({ credux: 1000000 }).where(eq(s.usersBag.discordId, id));
		expect((await raid.run(id, true)).status).toBe('ok');
		expect((await raid.run(id, true)).status).toBe('boss-locked');
		// Anchor on the STORED log timestamp (DB-clock, TZ-shifted on read):
		// advancing the fake battle clock relative to it is immune to skew.
		const [log] = await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id));
		now = new Date(log.timestamp.getTime() + 14 * 60000);
		expect((await raid.run(id, true)).status).toBe('boss-locked');
		now = new Date(log.timestamp.getTime() + 16 * 60000);
		expect((await raid.run(id, true)).status).toBe('ok');
	});
});
