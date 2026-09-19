import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';

// Real PostgreSQL SQL/transactions in an isolated in-memory database. No .env,
// Discord token, network connection or production database is read by this suite.
vi.mock('../src/db/client.js', async () => {
	const { PGlite } = await import('@electric-sql/pglite');
	const { drizzle } = await import('drizzle-orm/pglite');
	const schema = await import('../src/db/schema.js');
	const client = new PGlite();
	return { db: drizzle(client, { schema }), pool: { end: () => client.close() }, testClient: client };
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { RegistrationService } from '../src/services/RegistrationService.js';
import { CharacterCreationService } from '../src/services/CharacterCreationService.js';
import { SummonService } from '../src/services/SummonService.js';
import { LootService } from '../src/services/LootService.js';
import { LoadoutService } from '../src/services/LoadoutService.js';
import { StatAssemblyService } from '../src/services/StatAssemblyService.js';
import { QuestService } from '../src/services/QuestService.js';
import { ReputationService } from '../src/services/ReputationService.js';
import { DuelService, DUEL_STAKE_MIN } from '../src/services/DuelService.js';
import { RankedService } from '../src/services/RankedService.js';
import { PvpShopService } from '../src/services/PvpShopService.js';
import { CosmeticService } from '../src/services/CosmeticService.js';
import { ClassChangeService } from '../src/services/ClassChangeService.js';
import { ProfileService } from '../src/services/ProfileService.js';
import { WEAPON_SEED } from '../src/seed/data/weapons.js';
import { ARMOR_SEED } from '../src/seed/data/armors.js';
import { RUNE_SEED } from '../src/seed/data/runes.js';
import { DEITY_SEED } from '../src/seed/data/deities.js';
import { MOB_SEED } from '../src/seed/data/mobs.js';
import { ESSENCE_BAG_DEF_SEED, SOCKET_UNLOCK_COST_SEED } from '../src/seed/data/runeEconomy.js';
import { COSMETIC_SEED } from '../src/seed/data/cosmetics.js';
import { TITLE_SEED } from '../src/seed/data/titles.js';
import { RANKED_REWARD_SEED } from '../src/seed/data/rankedRewards.js';
import { subscribeDomainEvents } from '../src/core/subscribeDomainEvents.js';
import * as rngModule from '../src/domain/combat/Rng.js';

let id: string;
let sequence = 0;
const bag = async () => (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0];

beforeAll(async () => {
	const { testClient } = await import('../src/db/client.js') as unknown as { testClient: { exec(sql: string): Promise<unknown> } };
	await testClient.exec(await readFile(new URL('../src/db/migrations/0000_nasty_molecule_man.sql', import.meta.url), 'utf8'));
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
	await db.insert(s.runeRoster).values(RUNE_SEED.map((r, i) => ({ ...r, runeId: i + 1 })));
	await db.insert(s.deityRoster).values(DEITY_SEED);
	await db.insert(s.mobRoster).values(MOB_SEED);
	await db.insert(s.essenceBagDef).values(ESSENCE_BAG_DEF_SEED);
	await db.insert(s.socketUnlockCost).values(SOCKET_UNLOCK_COST_SEED);
	await db.insert(s.cosmeticCatalog).values(COSMETIC_SEED.map((c) => ({ ...c, isActive: true })));
	await db.insert(s.titleCatalog).values(TITLE_SEED);
	await db.insert(s.rankedReward).values(RANKED_REWARD_SEED);
	// Wire the real EventBus subscribers — duel/ranked believer EXP and quest
	// progress travel through the bus, exactly like production bootstrap.
	subscribeDomainEvents();
}, 30000);
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `test-${++sequence}`;
	await new RegistrationService().register(id, id);
	const c = await new CharacterCreationService().createCharacter(id, 'Knight');
	if (c.status !== 'ok') throw new Error(c.status);
});

const grantDeity = async (deityId: number) =>
	(
		await db
			.insert(s.userDeities)
			.values({ discordId: id, deityId, currAtk: 0, currHp: 0, currDef: 0, lastPullDate: '2026-01-01' })
			.returning({ userDeityId: s.userDeities.userDeityId })
	)[0].userDeityId;

describe('M7 pantheon + resonance', () => {
	it('weights slots 1/2/3 at 100/50/25% and resonates same-mythology sets', async () => {
		const ud1 = await grantDeity(1); // Bathala 180/900/160 — Filipino
		const ud2 = await grantDeity(2); // Amihan 210/780/140 — Filipino
		const ud3 = await grantDeity(3); // Amanikable 195/850/155 — Filipino
		const loadout = new LoadoutService();
		const base = await new StatAssemblyService().assemble(id, 'Knight', 1);

		await loadout.equip(id, 'deity', String(ud1));
		const one = await new StatAssemblyService().assemble(id, 'Knight', 1);
		// Sigil 0 → 50% base: Bathala eff atk 90, hp 450, def 80. No resonance alone.
		expect(one.stats.atk).toBe(base.stats.atk + 90);
		expect(one.blessings[0]).toEqual({ key: 'guardian_light', strength: 0.5 });

		await loadout.equip(id, 'deity2', String(ud2));
		const two = await new StatAssemblyService().assemble(id, 'Knight', 1);
		// Pair resonance ×1.1: atk (90 + 0.5×105)×1.1 = 156.75 → 156.
		expect(two.stats.atk).toBe(base.stats.atk + Math.floor((90 + 0.5 * 105) * 1.1));
		expect(two.stats.hp).toBe(base.stats.hp + Math.floor((450 + 0.5 * 390) * 1.1));

		// A deity cannot hold two slots at once.
		await expect(loadout.equip(id, 'deity', String(ud2))).resolves.toContain('slot pantheon khác');

		await loadout.equip(id, 'deity3', String(ud3));
		const three = await new StatAssemblyService().assemble(id, 'Knight', 1);
		// Triple resonance ×1.2: (90 + 52.5 + 0.25×97.5)×1.2 = 200.25 → 200.
		expect(three.stats.atk).toBe(base.stats.atk + Math.floor((90 + 52.5 + 0.25 * 97.5) * 1.2));
	});
});

describe('M7 quests + believer EXP', () => {
	it('generates quests lazily, credits rewards and pays the daily relic + weekly grand', async () => {
		vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0); // deterministic picks + min rewards
		const quests = new QuestService();
		const view = await quests.view(id);
		expect(view).toContain('Thắng 5 lượt /raid hunt');
		expect(view).toContain('Weekly quests');

		// Daily: raid_win ×5, summon ×3, enhance ×2 (rng 0 picks the first three templates).
		for (let i = 0; i < 5; i++) await quests.progress(id, 'raid_win');
		for (let i = 0; i < 3; i++) await quests.progress(id, 'summon');
		for (let i = 0; i < 2; i++) await quests.progress(id, 'enhance');
		expect((await bag()).sacredRelics).toBe(1);
		// Daily all-complete paid 3 quest rewards (20k each) + believer exp 25×3.
		expect((await bag()).credux).toBeGreaterThanOrEqual(60000);
		const [afterDaily] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(afterDaily.believerExp).toBe(75);

		// Weekly: raid_win ×15, summon ×10, duel_win ×5 (first three weekly templates at rng 0).
		for (let i = 0; i < 15; i++) await quests.progress(id, 'raid_win');
		for (let i = 0; i < 10; i++) await quests.progress(id, 'summon');
		for (let i = 0; i < 5; i++) await quests.progress(id, 'duel_win');
		expect(await quests.claimWeeklyGrand(id)).toContain('Weekly Grand');
		expect((await bag()).diamondChest).toBe(1);
		expect(await quests.claimWeeklyGrand(id)).toContain('đã nhận');

		// Non-rolled quest types are a no-op.
		await quests.progress(id, 'daily');
		expect((await bag()).sacredRelics).toBe(1);
	});

	it('caps believer EXP per Manila day and levels up at the threshold', async () => {
		const reputation = new ReputationService();
		for (let i = 0; i < 10; i++) await reputation.award(id, 'daily'); // 10×50 = cap 500
		const [c1] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(c1.believerLevel).toBe(2); // cost(1) = 500 → level up with 0 left
		expect(c1.reputationExpToday).toBe(500);
		await reputation.award(id, 'daily'); // capped — no further gain today
		const [c2] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(c2.believerExp).toBe(0);
		expect(c2.reputationExpToday).toBe(500);
	});
});

describe('M7 duels', () => {
	it('creates, accepts, pays the wager to the winner and logs everything', async () => {
		const id2 = `test-${++sequence}-opponent`;
		await new RegistrationService().register(id2, id2);
		await new CharacterCreationService().createCharacter(id2, 'Mage');
		await db.update(s.usersBag).set({ credux: 5000 }).where(eq(s.usersBag.discordId, id));
		await db.update(s.usersBag).set({ credux: 5000 }).where(eq(s.usersBag.discordId, id2));

		const duels = new DuelService();
		expect(await duels.create(id, id, 1000)).toEqual({ status: 'self' });
		expect(await duels.create(id, id2, DUEL_STAKE_MIN - 1)).toEqual({ status: 'invalid-stake' });
		expect(await duels.create(id, 'ghost', 0)).toEqual({ status: 'not-registered', who: 'opponent' });

		const created = await duels.create(id, id2, 1000);
		expect(created.status).toBe('ok');
		// One pending duel per player.
		expect(await duels.create(id, id2, 1000)).toEqual({ status: 'busy', who: 'challenger' });
		expect(await duels.create(id2, id, 0)).toEqual({ status: 'busy', who: 'challenger' });
		// Only the opponent can accept.
		expect(await duels.accept(created.status === 'ok' ? created.duelId : '', id)).toEqual({ status: 'not-opponent' });

		const result = await duels.accept((created as { duelId: string }).duelId, id2);
		if (result.status !== 'ok') throw new Error(`duel failed: ${result.status}`);
		expect(['player_win', 'enemy_win', 'draw']).toContain(result.battle.outcome);
		const [log] = await db.select().from(s.pvpLogs).where(eq(s.pvpLogs.duelId, (created as { duelId: string }).duelId));
		const [wager] = await db.select().from(s.wagerLogs);
		expect(wager.amount).toBe(1000);
		const winnerBag = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, log.winnerId));
		const loserId = log.winnerId === id ? id2 : id;
		const loserBag = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, loserId));
		expect(winnerBag[0].credux).toBe(6000);
		expect(loserBag[0].credux).toBe(4000);
		const [winnerChar] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, log.winnerId));
		expect(winnerChar.pvpWins).toBe(1);
		// Believer EXP travels through the (async) EventBus subscriber.
		await vi.waitFor(async () => {
			const [c] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, log.winnerId));
			expect(c.believerExp).toBe(40); // duel_win
		});
		expect(log.challengerDamage).toBeGreaterThanOrEqual(0);
		void wager;
	});

	it('declines, expires and refunds nothing on pending wagers', async () => {
		const id2 = `test-${++sequence}-opponent`;
		await new RegistrationService().register(id2, id2);
		await new CharacterCreationService().createCharacter(id2, 'Mage');
		const duels = new DuelService();

		const created = await duels.create(id, id2, 0);
		expect(await duels.decline((created as { duelId: string }).duelId, id)).toBe(true);
		expect(await db.select().from(s.activeDuels)).toHaveLength(0);

		const stale = await duels.create(id, id2, 0);
		expect(await duels.expireStale(new Date(Date.now() + 61_000))).toBe(1);
		expect(await db.select().from(s.activeDuels)).toHaveLength(0);
		// Participants cascade with the duel.
		expect(await db.select().from(s.activeDuelParticipants).where(eq(s.activeDuelParticipants.discordId, id))).toHaveLength(0);
		// Accepting a swept duel fails cleanly.
		expect(await duels.accept((stale as { duelId: string }).duelId, id2)).toEqual({ status: 'not-found' });
	});
});

describe('M7 ranked', () => {
	it('fights an async mirror match, moves Elo both ways and pays the weekly claim once', async () => {
		const id2 = `test-${++sequence}-opponent`;
		await new RegistrationService().register(id2, id2);
		await new CharacterCreationService().createCharacter(id2, 'Mage');

		const ranked = new RankedService();
		expect(await ranked.claim(id)).toEqual({ status: 'no-fights' });

		const result = await ranked.fight(id);
		if (result.status !== 'ok') throw new Error(`ranked failed: ${result.status}`);
		expect(result.ratingAfter).not.toBe(result.ratingBefore);
		const [me] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(me.pvpRating).toBe(result.ratingAfter);
		const logs = await db.select().from(s.rankedLogs);
		expect(logs).toHaveLength(2); // both perspectives
		expect(await db.select().from(s.seasons)).toHaveLength(1); // lazy season

		const claim = await ranked.claim(id);
		if (claim.status !== 'ok') throw new Error(`claim failed: ${claim.status}`);
		expect(claim.credux).toBe(50_000); // Mortal weekly
		expect(claim.valor).toBe(2);
		expect((await bag()).valorMedals).toBe(2);
		expect(await ranked.claim(id)).toEqual({ status: 'already-claimed' });

		// The initiator's own lock prevents double-queueing inside the fight tx —
		// sequential fights release it, so a second fight is possible again.
		const second = await ranked.fight(id);
		expect(second.status).toBe('ok');
	});
});

describe('M7 relics, rune bags and new chests', () => {
	it('pulls forced tiers with relics without touching pity or shards', async () => {
		await db.update(s.usersBag).set({ sacredRelics: 2, supremeRelics: 1 }).where(eq(s.usersBag.discordId, id));
		const result = await new SummonService().run(id, 2, 'sacred');
		if (result.status !== 'ok') throw new Error(`relic pull failed: ${result.status}`);
		expect(result.pulls.every((p) => p.tier === 'Mythic' || p.tier === 'Legendary' || p.tier === 'Supreme')).toBe(true);
		expect((await bag()).sacredRelics).toBe(0);
		expect((await bag()).beliefShards).toBe(1000); // shards untouched
		const grants = await db.select().from(s.summonRewardGrants);
		expect(grants).toHaveLength(2);
		const [pity] = await db.select().from(s.pityCounters).where(eq(s.pityCounters.discordId, id));
		expect(pity?.pityCount ?? 0).toBe(0); // pity untouched
		expect(await new SummonService().run(id, 1, 'sacred')).toEqual({
			status: 'insufficient-relics', relic: 'sacred', needed: 1, have: 0,
		});
		const supreme = await new SummonService().run(id, 1, 'supreme');
		if (supreme.status !== 'ok') throw new Error('supreme relic failed');
		expect(['Legendary', 'Supreme']).toContain(supreme.pulls[0].tier);
	});

	it('opens inventory rune bags against the seeded pools', async () => {
		await db.update(s.usersBag).set({ lesserRuneBag: 1, divineRuneBag: 1 }).where(eq(s.usersBag.discordId, id));
		const svc = new LootService();
		expect(await svc.openRuneBag(id, 'xx')).toContain('lb | gb | db');
		const runesBefore = (await db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id))).length;
		expect(await svc.openRuneBag(id, 'lb')).toContain('Mở túi lb');
		expect((await db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id))).length).toBe(runesBefore + 1);
		expect((await bag()).lesserRuneBag).toBe(0);
		expect(await svc.openRuneBag(id, 'lb')).toContain('Không đủ');
		expect(await svc.openRuneBag(id, 'db')).toContain('Mở túi db');
	});

	it('opens diamond and genesis chests with rune-bag drops and supreme loot', async () => {
		vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
		await db.update(s.usersBag).set({ diamondChest: 1, genesisChest: 1 }).where(eq(s.usersBag.discordId, id));
		const before = await bag();
		const svc = new LootService();
		expect(await svc.open(id, 'diamond', 1)).toContain('Diamond');
		const afterDiamond = await bag();
		expect(afterDiamond.diamondChest).toBe(0);
		expect(afterDiamond.credux).toBe(before.credux + 200_000);
		expect(afterDiamond.greaterRuneBag).toBe(before.greaterRuneBag + 1); // 50/25 roll at rng 0
		expect(await svc.open(id, 'genesis', 1)).toContain('Genesis');
		const afterGenesis = await bag();
		expect(afterGenesis.genesisChest).toBe(0);
		expect(afterGenesis.supremeEssence).toBe(before.supremeEssence + 1);
		expect(afterGenesis.divineRuneBag).toBe(before.divineRuneBag + 1); // guaranteed db
		const runes = await db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id));
		expect(runes.length).toBeGreaterThanOrEqual(2); // Legendary (diamond) + Supreme (genesis)
	});
});

describe('M7 cosmetics, titles, class change', () => {
	it('grants base cosmetics on create, gates shop items behind valor and equips titles', async () => {
		const owned = await db.select().from(s.userCosmetics).where(eq(s.userCosmetics.discordId, id));
		expect(owned).toHaveLength(2); // base_profile + base_battle

		const pvp = new PvpShopService();
		await db.update(s.usersBag).set({ valorMedals: 200 }).where(eq(s.usersBag.discordId, id));
		expect(await pvp.buy(id, 'nonexistent')).toContain('không tồn tại');
		expect(await pvp.buy(id, 'change_class')).toContain('Đã mua');
		expect((await bag()).changeClass).toBe(1);
		expect((await bag()).valorMedals).toBe(80);

		expect(await pvp.buy(id, 'frame_gold')).toContain('Đã mua');
		expect(await pvp.buy(id, 'frame_gold')).toContain('tối đa');
		const catalog = await db.select().from(s.cosmeticCatalog);
		const gold = catalog.find((c) => c.cosmeticKey === 'frame_gold')!;
		const cosmetics = new CosmeticService();
		expect(await cosmetics.equipCosmetic(id, gold.cosmeticId)).toContain('Đã trang bị');

		expect(await pvp.buy(id, 'title_champion')).toContain('Cần'); // 120 > 40 left
		await db.update(s.usersBag).set({ valorMedals: 200 }).where(eq(s.usersBag.discordId, id));
		expect(await pvp.buy(id, 'title_champion')).toContain('Đã mua');
		const titles = await db.select().from(s.userTitles).where(eq(s.userTitles.discordId, id));
		expect(await cosmetics.equipTitle(id, titles[0].titleId)).toContain('Đã đeo');

		const profile = await new ProfileService().get(id);
		if (profile.status !== 'ok') throw new Error('profile failed');
		expect(profile.data.title).toContain('Champion');
		expect(profile.data.believerLevel).toBe(1);
		expect(profile.data.pvpRating).toBe(1000);
	});

	it('changes class by consuming a change-class token and keeps everything else', async () => {
		const svc = new ClassChangeService();
		expect(await svc.change(id, 'Mage')).toContain('Token');
		await db.update(s.usersBag).set({ changeClass: 1 }).where(eq(s.usersBag.discordId, id));
		expect(await svc.change(id, 'Knight')).toContain('đã là class này');
		expect(await svc.change(id, 'Mage')).toContain('Mage');
		const [character] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(character.class).toBe('Mage');
		expect(character.combatLevel).toBe(1);
		expect((await bag()).changeClass).toBe(0);
	});
});
