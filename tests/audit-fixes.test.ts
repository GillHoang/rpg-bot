import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { testPersistence } from './helpers/persistence.js';
import { eq } from 'drizzle-orm';

// Covers the MAJOR findings of the pvp/casino/meta/progression business review.
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { DuelService } from '../src/modules/pvp/application/DuelService.js';
import { RankedService } from '../src/modules/pvp/application/RankedService.js';
import { QuestService } from '../src/modules/meta/application/QuestService.js';
import { SeasonService } from '../src/modules/meta/application/SeasonService.js';
import { LoadoutService } from '../src/modules/progression/application/LoadoutService.js';
import { EnhancementService } from '../src/modules/progression/application/EnhancementService.js';
import { mitigate } from '../src/modules/combat-shared/domain/DamageCalculator.js';
import { applyDebuff, createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { BaccaratGame } from '../src/modules/casino/domain/games/BaccaratGame.js';
import { BANKER_PAYOUT_MULT, EVEN_MONEY } from '../src/shared/config/casinoPayouts.js';
import { createRng } from '../src/modules/combat-shared/domain/Rng.js';
import { weekWindowAt } from '../src/shared/config/ranked.js';
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
let starter!: { weaponId: string; armorId: string };

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
	id = `fix-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
	starter = started;
});

const startSecond = async (suffix: string) => {
	const other = `${id}-${suffix}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(other, other, 'Mage');
	if (started.status !== 'ok') throw new Error(started.status);
	return other;
};

describe('mitigate() is total over negative effective DEF', () => {
	it('clamps negative DEF to zero instead of dividing by zero', () => {
		expect(mitigate(100, -600)).toBe(100);
		expect(mitigate(100, -1)).toBe(100);
		expect(mitigate(100, 0)).toBe(100);
		expect(mitigate(0, -600)).toBe(0);
		expect(mitigate(100, 600)).toBe(50);
	});
});

describe('applyDebuff refreshes fractional tags instead of stacking dead rows', () => {
	it('keeps one atk_down entry with the max value and refreshed duration', () => {
		const side = createCombatant({ name: 't', combatClass: 'Knight', hp: 100, atk: 10, def: 10, crit: 0 });
		const rng = () => 0.99;
		applyDebuff(side, { tag: 'atk_down', turnsLeft: 2, value: 0.15 }, rng);
		applyDebuff(side, { tag: 'atk_down', turnsLeft: 2, value: 0.1 }, rng);
		expect(side.debuffs.filter((d) => d.tag === 'atk_down')).toHaveLength(1);
		expect(side.debuffs.find((d) => d.tag === 'atk_down')?.value).toBe(0.15);
		applyDebuff(side, { tag: 'slow', turnsLeft: 1, value: 0.2 }, rng);
		applyDebuff(side, { tag: 'slow', turnsLeft: 3, value: 0.3 }, rng);
		expect(side.debuffs.filter((d) => d.tag === 'slow')).toHaveLength(1);
		expect(side.debuffs.find((d) => d.tag === 'slow')).toMatchObject({ value: 0.3, turnsLeft: 3 });
	});
});

describe('baccarat banker commission', () => {
	const bet = 100000;
	const findSeed = (wantWinner: 'player' | 'banker', wantPick: 'player' | 'banker'): number => {
		const game = new BaccaratGame();
		for (let seed = 1; seed <= 50000; seed++) {
			const outcome = game.play(bet, createRng(seed), wantPick);
			if (outcome.result === wantWinner && outcome.won) return seed;
		}
		throw new Error(`no seed found for ${wantPick}/${wantWinner}`);
	};

	it('pays banker wins at 1.95x and player wins at 2x', () => {
		const game = new BaccaratGame();
		const bankerSeed = findSeed('banker', 'banker');
		expect(game.play(bet, createRng(bankerSeed), 'banker').payout).toBe(Math.floor(bet * BANKER_PAYOUT_MULT));
		const playerSeed = findSeed('player', 'player');
		expect(game.play(bet, createRng(playerSeed), 'player').payout).toBe(Math.floor(bet * EVEN_MONEY));
	});

	it('keeps both sides at or below EV 1.0 over 20k seeded shoes', () => {
		const game = new BaccaratGame();
		for (const pick of ['player', 'banker'] as const) {
			let total = 0;
			const n = 20000;
			for (let seed = 1; seed <= n; seed++) total += game.play(bet, createRng(seed), pick).payout;
			const ev = total / n / bet;
			expect(ev).toBeLessThanOrEqual(1.0);
			expect(ev).toBeGreaterThan(0.9);
		}
	});
});

describe('ranked weekly claim requires an initiated fight', () => {
	it('lets the initiator claim while the mirror-match defender gets no-fights', async () => {
		const foe = await startSecond('foe');
		expect(foe).not.toBe(id); // helper registers a distinct second fighter
		const ranked = new RankedService(undefined, undefined, undefined, undefined, {
			persistence: testPersistence(),
		});
		const fight = await ranked.fight(id);
		expect(fight.status).toBe('ok');
		if (fight.status !== 'ok') throw new Error(`fight failed: ${fight.status}`);
		// The mirror-match defender was pulled in passively: no initiated
		// fight of their own, so no weekly claim — whoever they are.
		expect(await ranked.claim(fight.opponentId)).toEqual({ status: 'no-fights' });
		const claim = await ranked.claim(id);
		expect(claim.status).toBe('ok');
	});
});

describe('duel accept re-checks funds', () => {
	it('returns insufficient-funds when the opponent spent before accepting', async () => {
		const foe = await startSecond('foe');
		await db.update(s.usersBag).set({ credux: 5000 }).where(eq(s.usersBag.discordId, id));
		await db.update(s.usersBag).set({ credux: 5000 }).where(eq(s.usersBag.discordId, foe));
		const duels = new DuelService(undefined, undefined, undefined, undefined, undefined, {
			persistence: testPersistence(),
		});
		const created = await duels.create(id, foe, 5000);
		if (created.status !== 'ok') throw new Error(`create failed: ${created.status}`);
		await db.update(s.usersBag).set({ credux: 0 }).where(eq(s.usersBag.discordId, foe));
		expect(await duels.accept(created.duelId, foe)).toEqual({ status: 'insufficient-funds' });
		// Challenger was never debited.
		expect((await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0].credux).toBe(5000);
	});
});

describe('banned players are locked out of pvp', () => {
	it('rejects duel challenge and ranked fight for banned users', async () => {
		const foe = await startSecond('foe');
		await db.update(s.users).set({ isBanned: true }).where(eq(s.users.discordId, id));
		const duels = new DuelService(undefined, undefined, undefined, undefined, undefined, {
			persistence: testPersistence(),
		});
		expect(await duels.create(id, foe, 0)).toEqual({ status: 'not-registered', who: 'challenger' });
		const ranked = new RankedService(undefined, undefined, undefined, undefined, {
			persistence: testPersistence(),
		});
		expect(await ranked.fight(id)).toEqual({ status: 'not-registered' });
	});
});

describe('season auto-rollover', () => {
	it('closes an expired season and opens a fresh one on next ensureActive', async () => {
		const persistence = testPersistence();
		const seasons = new SeasonService(persistence);
		// Whatever season is active (possibly created by an earlier fight in
		// this file), force it expired — endsAt stays after startsAt so the
		// seasons_valid_window check holds.
		const first = await persistence.unitOfWork.run((tx) => seasons.ensureActive(tx));
		await db
			.update(s.seasons)
			.set({ startsAt: new Date(Date.now() - 31 * 86400000), endsAt: new Date(Date.now() - 1000) })
			.where(eq(s.seasons.seasonId, first.seasonId));
		const second = await persistence.unitOfWork.run((tx) => seasons.ensureActive(tx));
		expect(second.seasonId).not.toBe(first.seasonId);
		const [closed] = await db.select().from(s.seasons).where(eq(s.seasons.seasonId, first.seasonId));
		expect(closed.isActive).toBe(false);
	});
});

describe('weekly grand previous-week grace', () => {
	it('still pays the grand on Monday for a board finished on Sunday', async () => {
		const sunday = new Date('2026-01-04T16:59:00Z'); // Sunday 23:59 Vietnam
		const monday = new Date('2026-01-04T17:01:00Z'); // Monday 00:01 Vietnam
		// The finished board belongs to the ISO week CONTAINING Sunday.
		const prevWeek = weekWindowAt(sunday).key;
		expect(weekWindowAt(monday).key).not.toBe(prevWeek);
		await db.insert(s.weeklyQuests).values([
			{ discordId: id, questType: 'raid_win', targetCount: 15, currentCount: 15, rewardCredux: 50000, rewardValor: 5, completed: true, questWeek: prevWeek },
			{ discordId: id, questType: 'summon', targetCount: 10, currentCount: 10, rewardCredux: 50000, rewardValor: 5, completed: true, questWeek: prevWeek },
			{ discordId: id, questType: 'ranked', targetCount: 5, currentCount: 5, rewardCredux: 50000, rewardValor: 5, completed: true, questWeek: prevWeek },
		]);
		const quests = new QuestService(undefined, {
			persistence: testPersistence(),
			clock: { now: () => monday },
		});
		const before = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0];
		const result = await quests.claimWeeklyGrand(id);
		expect(result.ok).toBe(true);
		const after = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0];
		expect(after.diamondChest).toBe(before.diamondChest + 1);
		expect(await quests.claimWeeklyGrand(id)).toEqual(
			expect.objectContaining({ ok: false }),
		);
	});
});

describe('pantheon slot 2 is reachable through the loadout facade', () => {
	it('equips deity2 and rejects sharing one deity across two slots', async () => {
		const [ud1, ud2] = (
			await db
				.insert(s.userDeities)
				.values([
					{ discordId: id, deityId: 1, currAtk: 0, currHp: 0, currDef: 0, lastPullDate: '2026-01-01' },
					{ discordId: id, deityId: 2, currAtk: 0, currHp: 0, currDef: 0, lastPullDate: '2026-01-01' },
				])
				.returning({ userDeityId: s.userDeities.userDeityId })
		).map((r) => r.userDeityId);
		const loadout = new LoadoutService({ persistence: testPersistence() });
		expect((await loadout.equip(id, 'deity', String(ud1))).ok).toBe(true);
		expect((await loadout.equip(id, 'deity2', String(ud2))).ok).toBe(true);
		const clash = await loadout.equip(id, 'deity3', String(ud1));
		expect(clash.ok).toBe(false);
	});
});

describe('starter Common gear reports honestly', () => {
	it('returns not-enhanceable for the Common starter weapon', async () => {
		const result = await new EnhancementService(undefined, undefined, {
			persistence: testPersistence(),
		}).attempt(id, starter.weaponId);
		expect(result).toEqual({ status: 'not-enhanceable' });
	});
});
