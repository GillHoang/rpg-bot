import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testPersistence } from './helpers/persistence.js';
import { textOf } from './helpers/result.js';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { eq } from 'drizzle-orm';

// Real PostgreSQL SQL/transactions in an isolated in-memory database. No .env,
// Discord token, network connection or production database is read by this suite.
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { LootService } from '../src/modules/economy/application/LootService.js';
import { LoadoutService } from '../src/modules/progression/application/LoadoutService.js';
import { SocketService } from '../src/modules/progression/application/SocketService.js';
import { CasinoSessionService } from '../src/modules/casino/application/CasinoSessionService.js';
import { ClaimDailyUseCase } from '../src/modules/economy/application/ClaimDailyUseCase.js';
import { RaidService } from '../src/modules/pve/application/RaidService.js';
import { RunSummonUseCase } from '../src/modules/progression/application/RunSummonUseCase.js';
import { AscensionService } from '../src/modules/progression/application/AscensionService.js';
import { EnhancementService } from '../src/modules/progression/application/EnhancementService.js';
import { StatAssemblyService } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { InventoryService } from '../src/modules/progression/application/InventoryService.js';
import { LootGrantService } from '../src/modules/economy/application/LootGrantService.js';
import { MonsterEncounterService } from '../src/modules/pve/application/MonsterEncounterService.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { RUNE_SEED } from '../src/modules/progression/seed/runes.js';
import { DEITY_SEED } from '../src/modules/progression/seed/deities.js';
import { MOB_SEED } from '../src/modules/pve/seed/mobs.js';
import { ESSENCE_BAG_DEF_SEED, SOCKET_UNLOCK_COST_SEED } from '../src/modules/progression/seed/runeEconomy.js';
import { COSMETIC_SEED } from '../src/modules/meta/seed/cosmetics.js';
import { TITLE_SEED } from '../src/modules/meta/seed/titles.js';
import * as rngModule from '../src/modules/combat-shared/domain/Rng.js';

let id: string;
let sequence = 0;
let starter: { weaponId: string; armorId: string };
const bag = async () => (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0];

beforeAll(async () => {
	const { testClient } = await import('../src/db/client.js') as unknown as TestDatabase;
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
}, 120000);
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `test-${++sequence}`;
	const c = await new StartService(undefined, undefined, undefined, undefined, undefined, { persistence: testPersistence() }).start(id, id, 'Knight');
	if (c.status !== 'ok') throw new Error(c.status);
	starter = c;
});

describe('closed gameplay economy', () => {
	it('creates starter resources, two presets and usable sockets exactly once', async () => {
		expect((await bag()).silverChest).toBe(10);
		expect((await bag()).beliefShards).toBe(1000);
		expect(await new StartService(undefined, undefined, undefined, undefined, undefined, { persistence: testPersistence() }).start(id, id, 'Mage')).toEqual({ status: 'already-has-character' });
		const weapons = await new InventoryService(testPersistence().executor).list(id, 'weapons', 1);
		expect(weapons[0]).toContain(starter.weaponId);
		expect(await new InventoryService(testPersistence().executor).list(id, 'weapons', 2)).toEqual([]);
	});
	it('opens a chest atomically, grants items and rejects excessive or invalid counts', async () => {
		vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
		const result = textOf(await new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, 'silver', 1));
		expect(result).toContain((10000).toLocaleString());
		expect((await bag()).silverChest).toBe(9);
		expect((await bag()).beliefShards).toBe(1020);
		expect((await db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id)))).toHaveLength(1);
		expect((await db.select().from(s.userWeapons).where(eq(s.userWeapons.discordId, id)))).toHaveLength(2);
		expect(textOf(await new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, 'silver', 10))).toContain('Không đủ');
		expect(textOf(await new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, 'silver', -1))).toContain('1–10');
		expect(textOf(await new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, '__proto__' as never, 1))).toContain('hợp lệ');
	});
	it('rolls back currency, chest and earlier items if a later reward cannot be granted', async () => {
		const before = await bag();
		vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
		vi.spyOn(LootGrantService.prototype, 'gear').mockRejectedValue(new Error('missing roster'));
		await expect(new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, 'silver', 1)).rejects.toThrow('missing roster');
		expect(await bag()).toEqual(before);
		expect(await db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id))).toHaveLength(0);
	});
	it('does not double-spend the last chest under simultaneous opens', async () => {
		await db.update(s.usersBag).set({ silverChest: 1 }).where(eq(s.usersBag.discordId, id));
		const results = await Promise.all([new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, 'silver', 1), new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, 'silver', 1)]);
		expect(results.map(textOf).filter(r => r.includes('Không đủ'))).toHaveLength(1);
		expect((await bag()).silverChest).toBe(0);
	});
	it('buys one rune from the seeded pool and charges both resources once', async () => {
		await db.update(s.usersBag).set({ credux: 20000, legendaryEssence: 15 }).where(eq(s.usersBag.discordId, id));
		const shop = new LootService(undefined, undefined, { persistence: testPersistence() });
		expect(textOf(await shop.shop(id))).toContain('lb');
		expect(textOf(await shop.shop(id, 'lb'))).toContain('Nhận');
		expect((await bag()).credux).toBe(0);
		expect((await bag()).legendaryEssence).toBe(0);
		expect(textOf(await shop.shop(id, 'lb'))).toContain('Cần');
		expect(await db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id))).toHaveLength(1);
	});
	it('rejects foreign gear and lets preset 2 affect combat stats', async () => {
		const loadout = new LoadoutService({ persistence: testPersistence() });
		expect(textOf(await loadout.equip(id, 'weapon', 'foreign'))).toContain('không sở hữu');
		const before = await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);
		await loadout.switch(id, 2);
		const empty = await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);
		expect(empty.stats.atk).toBeLessThan(before.stats.atk);
		await loadout.equip(id, 'weapon', starter.weaponId);
		await loadout.equip(id, 'armor', starter.armorId);
		expect((await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1)).stats).toEqual(before.stats);
		expect(textOf(await loadout.switch(id, 3))).toContain('1 hoặc 2');
	});
	it('supports both rune lanes, atomic moves, removal and 5% stats from fractional seed', async () => {
		await db.insert(s.userRunes).values([{ discordId: id, runeUid: `${id}-sharp`, runeId: 1 }, { discordId: id, runeUid: `${id}-aegis`, runeId: 11 }]);
		const socket = new SocketService(undefined, undefined, { persistence: testPersistence() });
		const before = await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);
		expect((await socket.equip(id, `${id}-aegis`, starter.weaponId, 1)).status).toBe('lane-mismatch');
		expect((await socket.equip(id, `${id}-aegis`, starter.weaponId, 1, 'opposite')).status).toBe('ok');
		expect((await socket.equip(id, `${id}-sharp`, starter.weaponId, 1)).status).toBe('ok');
		expect((await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1)).stats.atk).toBe(Math.floor(before.stats.atk * 1.05));
		await socket.equip(id, `${id}-aegis`, starter.armorId, 1, 'opposite');
		const [weapon] = await db.select().from(s.userWeapons).where(eq(s.userWeapons.weaponId, starter.weaponId));
		expect(weapon.oppositeSockets).toEqual([null]);
		await socket.unequip(id, `${id}-aegis`);
		const [armor] = await db.select().from(s.userArmors).where(eq(s.userArmors.armorId, starter.armorId));
		expect(armor.oppositeSockets).toEqual([null]);
	});
	it('opens paid native sockets using the tier-specific seeded price', async () => {
		await db.update(s.userWeapons).set({ weaponRosterId: 101 }).where(eq(s.userWeapons.weaponId, starter.weaponId));
		await db.update(s.usersBag).set({ credux: 5000, epicEssence: 5 }).where(eq(s.usersBag.discordId, id));
		expect(textOf(await new SocketService(undefined, undefined, { persistence: testPersistence() }).unlock(id, starter.weaponId))).toContain('socket 2');
		expect((await bag()).credux).toBe(0);
		expect((await bag()).epicEssence).toBe(0);
		expect((await db.select().from(s.userWeapons).where(eq(s.userWeapons.weaponId, starter.weaponId)))[0].nativeSockets).toEqual([null, null]);
	});
	it('serializes simultaneous daily claims', async () => {
		const results = await Promise.all([new ClaimDailyUseCase(undefined, undefined, { persistence: testPersistence() }).claim(id), new ClaimDailyUseCase(undefined, undefined, { persistence: testPersistence() }).claim(id)]);
		expect(results.map(r => r.status).sort()).toEqual(['already-claimed', 'ok']);
	});
	it('keeps summon resources unchanged when seed is missing', async () => {
		const { DeityService } = await import('../src/modules/progression/application/DeityService.js');
		const first = await new DeityService().pickRandomAvailableForTier(db, 'Epic', () => 0);
		vi.spyOn(DeityService.prototype, 'pickRandomAvailableForTier').mockResolvedValueOnce(first).mockResolvedValue(null);
		const before = await bag();
		expect((await new RunSummonUseCase(undefined, undefined, undefined, { persistence: testPersistence() }).run(id, 2)).status).toBe('no-deities-seeded');
		expect(await bag()).toEqual(before);
		expect(await db.select().from(s.userDeities).where(eq(s.userDeities.discordId, id))).toHaveLength(0);
	});
	it('summons, auto-equips, earns duplicate essence and progresses through Sigil/Ascension', async () => {
		vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
		const before = await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);
		expect((await new RunSummonUseCase(undefined, undefined, undefined, { persistence: testPersistence() }).run(id, 2)).status).toBe('ok');
		expect((await bag()).beliefShards).toBe(800);
		expect((await bag()).epicEssence).toBe(1);
		const [owned] = await db.select().from(s.userDeities).where(eq(s.userDeities.discordId, id));
		expect((await new InventoryService(testPersistence().executor).list(id, 'deities', 1))[0]).toContain(`ID: \`${owned.userDeityId}\``);
		const summoned = await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);
		expect(summoned.stats.atk).toBeGreaterThan(before.stats.atk);
		await db.update(s.usersBag).set({ credux: 100000, epicEssence: 200 }).where(eq(s.usersBag.discordId, id));
		const service = new AscensionService(undefined, { persistence: testPersistence() });
		for (let n = 1; n <= 10; n++) expect(await service.addSigil(id, owned.userDeityId)).toEqual({ status: 'ok', newSigils: n });
		const maxed = await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);
		expect(maxed.stats.atk).toBeGreaterThan(summoned.stats.atk);
		expect(await service.ascend(id, owned.userDeityId)).toEqual({ status: 'ok' });
		expect((await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1)).stats).toEqual(maxed.stats);
		expect((await bag()).credux).toBe(0);
		expect((await service.ascend(id, owned.userDeityId)).status).toBe('already-ascended');
	});
	it('enhances looted gear and uses its improved stats in the active preset', async () => {
		vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
		await new LootService(undefined, undefined, { persistence: testPersistence() }).open(id, 'silver', 1);
		const weapon = (await db.select().from(s.userWeapons).where(eq(s.userWeapons.discordId, id))).find(w => w.weaponId !== starter.weaponId)!;
		await new LoadoutService({ persistence: testPersistence() }).equip(id, 'weapon', weapon.weaponId);
		await db.update(s.usersBag).set({ credux: 1000000 }).where(eq(s.usersBag.discordId, id));
		const before = await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1);
		expect((await new EnhancementService(undefined, undefined, { persistence: testPersistence() }).attempt(id, weapon.weaponId)).status).toBe('success');
		expect((await new StatAssemblyService(undefined, undefined, undefined, { persistence: testPersistence() }).assemble(id, 'Knight', 1)).stats.atk).toBeGreaterThan(before.stats.atk);
		expect((await bag()).credux).toBeLessThan(1000000);
	});
	it('selects regular/elite with seeded RNG and grants elite Gold Chest', async () => {
		const repo = new MonsterEncounterService();
		expect((await repo.pickForLevel(db, 1, () => 0))?.mobType).toBe('regular');
		expect((await repo.pickForLevel(db, 1, () => 0.9))?.mobType).toBe('elite');
		vi.spyOn(MonsterEncounterService.prototype, 'pickForLevel').mockResolvedValue({ name: 'Elite', hp: 1, atk: 1, def: 0, crit: 0, mobType: 'elite', skillKey: 'none', immunityTags: [] });
		vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
		const result = await new RaidService({ persistence: testPersistence() }).run(id);
		expect(result.status).toBe('ok');
		if (result.status === 'ok') expect(result.chestName).toBe('Gold Chest');
		expect((await bag()).goldChest).toBe(1);
		// raid history is written for every battle; a win feeds the streak.
		const [log] = await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id));
		expect(log.result).toBe('win');
		expect(log.enemyTier).toBe('elite');
		const [character] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(character.highestRaidStreak).toBe(1);
	});
	it('applies hunt cooldown in the service across instances and only after a valid hunt', async () => {
		const pick = vi
			.spyOn(MonsterEncounterService.prototype, 'pickForLevel')
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ name: 'Pugot', hp: 1, atk: 1, def: 0, crit: 0, mobType: 'regular', skillKey: 'none', immunityTags: [] });
		const first = await new RaidService({ persistence: testPersistence() }).run(id);
		expect(first.status).toBe('no-monsters-seeded');
		expect(await db.select().from(s.huntCooldowns).where(eq(s.huntCooldowns.discordId, id))).toHaveLength(0);
		const valid = await new RaidService({ persistence: testPersistence() }).run(id);
		expect(valid.status).toBe('ok');
		const retry = await new RaidService({ persistence: testPersistence() }).run(id);
		expect(retry.status).toBe('cooldown');
		if (retry.status === 'cooldown') expect(retry.retryAt.getTime()).toBeGreaterThan(Date.now());
		expect(pick).toHaveBeenCalledTimes(2);
	});
	it('enforces boss level, fee and daily limit; rewards a victory atomically', async () => {
		const raid = new RaidService({ persistence: testPersistence() });
		expect((await raid.run(id, true)).status).toBe('boss-locked');
		await db.update(s.userCharacter).set({ combatLevel: 10 }).where(eq(s.userCharacter.discordId, id));
		expect((await raid.run(id, true)).status).toBe('boss-locked');
		await db.update(s.usersBag).set({ credux: 10000 }).where(eq(s.usersBag.discordId, id));
		vi.spyOn(MonsterEncounterService.prototype, 'pickForLevel').mockResolvedValue({ name: 'Boss', hp: 1, atk: 1, def: 0, crit: 0, mobType: 'boss', skillKey: 'moon_threshold', immunityTags: ['stun'] });
		const first = await raid.run(id, true);
		expect(first.status).toBe('ok');
		expect((await bag()).bossTreasureChest).toBe(1);
		const [character] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(character.bossKills).toBe(1);
		expect(character.raidsWon).toBe(0);
		expect(character.raidsLost).toBe(0);
		const [bossLog] = await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id));
		expect(bossLog.battleType).toBe('boss');
		expect(bossLog.result).toBe('win');
		const after = await bag();
		expect((await raid.run(id, true)).status).toBe('boss-locked');
		expect(await bag()).toEqual(after);
	});
});

describe('persistent casino sessions', () => {
	it('settles Blackjack with the saved replay payout and no second debit', async () => {
		await db.update(s.usersBag).set({ credux: 1000 }).where(eq(s.usersBag.discordId, id));
		const service = new CasinoSessionService({ persistence: testPersistence() });
		const start = await service.start(id, 'blackjack', 100);
		if (start.status !== 'ok') throw new Error(start.text);
		await service.act(id, start.sessionId, 'stand');
		const [session] = await db.select().from(s.activeCasinoSessions).where(eq(s.activeCasinoSessions.sessionId, start.sessionId));
		expect(session.status).toBe('settled');
		expect([0, 100, 200]).toContain(session.payout);
		expect((await bag()).credux).toBe(900 + session.payout!);
		await service.act(id, start.sessionId, 'hit');
		expect(await db.select().from(s.casinoLogs).where(eq(s.casinoLogs.discordId, id))).toHaveLength(1);
	});
	it('ignores a second click on the same displayed revision', async () => {
		await db.update(s.usersBag).set({ credux: 1000 }).where(eq(s.usersBag.discordId, id));
		vi.spyOn(rngModule, 'createSecureSeed').mockReturnValue(1);
		const service = new CasinoSessionService({ persistence: testPersistence() });
		const start = await service.start(id, 'crash', 100);
		if (start.status !== 'ok') throw new Error(start.text);
		await service.act(id, start.sessionId, 'push', 0);
		await service.act(id, start.sessionId, 'push', 0);
		const [session] = await db.select().from(s.activeCasinoSessions).where(eq(s.activeCasinoSessions.sessionId, start.sessionId));
		expect((session.stateJson as { actions: string[] }).actions).toEqual(['push']);
	});
	it('debits up front, rejects second sessions, and credits exactly once', async () => {
		await db.update(s.usersBag).set({ credux: 1000 }).where(eq(s.usersBag.discordId, id));
		const service = new CasinoSessionService({ persistence: testPersistence() });
		const start = await service.start(id, 'crash', 100);
		if (start.status !== 'ok') throw new Error(start.text);
		expect((await bag()).credux).toBe(900);
		expect((await service.start(id, 'crash', 100)).status).toBe('error');
		expect((await service.act('other-player', start.sessionId, 'cash')).status).toBe('error');
		await Promise.all([service.act(id, start.sessionId, 'cash'), service.act(id, start.sessionId, 'cash')]);
		expect((await bag()).credux).toBe(1000);
		expect(await db.select().from(s.casinoLogs).where(eq(s.casinoLogs.discordId, id))).toHaveLength(1);
	});
	it('recovers expired sessions after restart and ignores late pushes', async () => {
		await db.update(s.usersBag).set({ credux: 1000 }).where(eq(s.usersBag.discordId, id));
		const start = await new CasinoSessionService({ persistence: testPersistence() }).start(id, 'crash', 100);
		if (start.status !== 'ok') throw new Error(start.text);
		await db.update(s.activeCasinoSessions).set({ expiresAt: new Date(0) }).where(eq(s.activeCasinoSessions.sessionId, start.sessionId));
		await new CasinoSessionService({ persistence: testPersistence() }).recoverExpired();
		await new CasinoSessionService({ persistence: testPersistence() }).act(id, start.sessionId, 'push');
		expect((await bag()).credux).toBe(1000);
		expect(await db.select().from(s.casinoLogs).where(eq(s.casinoLogs.discordId, id))).toHaveLength(1);
	});
});
