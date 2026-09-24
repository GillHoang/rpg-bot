import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { PersistenceContext } from '../src/shared/kernel/persistence.js';
import type { Transaction } from '../src/db/client.js';
import type { BattleResult } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createTestDatabase, migrateTestDatabase } from './helpers/database.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { CasinoService } from '../src/modules/casino/application/CasinoService.js';
import { CasinoSessionService } from '../src/modules/casino/application/CasinoSessionService.js';
import { DuelService } from '../src/modules/pvp/application/DuelService.js';
import { RaidService } from '../src/modules/pve/application/RaidService.js';
import { RankedService } from '../src/modules/pvp/application/RankedService.js';
import { PvpShopService } from '../src/modules/pvp/application/PvpShopService.js';
import { LootService } from '../src/modules/economy/application/LootService.js';
import { LootGrantService } from '../src/modules/economy/application/LootGrantService.js';
import { LoadoutService } from '../src/modules/progression/application/LoadoutService.js';
import { SocketService } from '../src/modules/progression/application/SocketService.js';
import { EnhancementService } from '../src/modules/progression/application/EnhancementService.js';
import { ResetService } from '../src/modules/system/application/ResetService.js';
import { PlayerCombatantFactory } from '../src/modules/combat-shared/application/combatantFactory.js';
import { DuelRepository } from '../src/modules/pvp/infrastructure/DuelRepository.js';
import { RaidRepository } from '../src/modules/pve/infrastructure/RaidRepository.js';
import { CasinoRepository } from '../src/modules/casino/infrastructure/CasinoRepository.js';
import { LootRepository } from '../src/modules/economy/infrastructure/LootRepository.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { RUNE_SEED } from '../src/modules/progression/seed/runes.js';
import { MOB_SEED } from '../src/modules/pve/seed/mobs.js';
import { TITLE_SEED } from '../src/modules/meta/seed/titles.js';
import { COSMETIC_SEED } from '../src/modules/meta/seed/cosmetics.js';
import { ESSENCE_BAG_DEF_SEED, SOCKET_UNLOCK_COST_SEED } from '../src/modules/progression/seed/runeEconomy.js';
import { RANKED_REWARD_SEED } from '../src/modules/pvp/seed/rankedRewards.js';
import * as rngModule from '../src/modules/combat-shared/domain/Rng.js';

// No global database is usable: every path, including default children, must use its supplied context.
vi.mock('../src/db/client.js', () => ({
	db: new Proxy(
		{},
		{
			get() {
				throw new Error('Unexpected global database access');
			},
		},
	),
}));

const isolated = createTestDatabase();
const other = createTestDatabase();
function instrument(database: typeof isolated) {
	const handles: Transaction[] = [];
	const order: string[] = [];
	const persistence: PersistenceContext = {
		executor: database.db as unknown as PersistenceContext['executor'],
		unitOfWork: {
			async run(work) {
				const result = await database.db.transaction((tx) => {
					handles.push(tx as unknown as Transaction);
					return work(tx as unknown as Transaction);
				});
				order.push('commit');
				return result;
			},
		},
	};
	return { persistence, handles, order };
}
const local = instrument(isolated);
const remote = instrument(other);
const persistence = local.persistence;
const events = { emit: vi.fn() };
let id: string;
let opponent: string;
let starter: { weaponId: string; armorId: string };
let sequence = 0;
const bag = async (database = isolated) =>
	(await database.db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0];
const character = async (database = isolated) =>
	(await database.db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id)))[0];
const win: BattleResult = {
	outcome: 'player_win',
	rounds: 1,
	log: [],
	roundLogs: [],
	playerHpRemaining: 1,
	enemyHpRemaining: 0,
};

beforeAll(async () => {
	for (const database of [isolated, other]) {
		await migrateTestDatabase(database.testClient);
		await database.db.insert(s.weaponRoster).values(WEAPON_SEED);
		await database.db.insert(s.armorRoster).values(ARMOR_SEED);
		await database.db.insert(s.runeRoster).values(RUNE_SEED.map((row, index) => ({ ...row, runeId: index + 1 })));
		await database.db.insert(s.mobRoster).values(MOB_SEED);
		await database.db.insert(s.titleCatalog).values(TITLE_SEED);
		await database.db.insert(s.cosmeticCatalog).values(COSMETIC_SEED.map((row) => ({ ...row, isActive: true })));
		await database.db.insert(s.essenceBagDef).values(ESSENCE_BAG_DEF_SEED);
		await database.db.insert(s.socketUnlockCost).values(SOCKET_UNLOCK_COST_SEED);
		await database.db.insert(s.rankedReward).values(RANKED_REWARD_SEED);
	}
}, 120000);

afterAll(async () => {
	await isolated.pool.end();
	await other.pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	events.emit.mockReset();
	vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
	id = `cohort-b-${++sequence}`;
	opponent = `${id}-opponent`;
	const start = new StartService(undefined, undefined, undefined, undefined, undefined, { persistence });
	const result = await start.start(id, id, 'Knight');
	if (result.status !== 'ok') throw new Error(result.status);
	starter = result;
	expect((await start.start(opponent, opponent, 'Knight')).status).toBe('ok');
	const otherStart = new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: remote.persistence,
	});
	expect((await otherStart.start(id, id, 'Mage')).status).toBe('ok');
	await isolated.db
		.update(s.usersBag)
		.set({ credux: 1_000_000, valorMedals: 1_000 })
		.where(eq(s.usersBag.discordId, id));
	await isolated.db.update(s.usersBag).set({ credux: 1_000_000 }).where(eq(s.usersBag.discordId, opponent));
	local.handles.length = 0;
	local.order.length = 0;
});

describe('service cohort B dependency and transaction boundaries', () => {
	it('publishes casino events after the supplied unit of work commits and isolates identical player IDs', async () => {
		const beforeOther = await bag(other);
		const emit = vi.fn(() => {
			local.order.push('event');
		});
		const repo = new CasinoRepository();
		const getCredux = vi.spyOn(repo, 'getCredux');
		const casino = new CasinoService(repo, { emit }, { persistence });
		const result = await casino.play(id, 'coin_toss', 100, 'heads');
		expect(result.status).toBe('ok');
		expect(local.order).toEqual(['commit', 'event']);
		expect(local.handles).toHaveLength(1);
		expect(getCredux.mock.calls.every(([tx]) => tx === local.handles[0])).toBe(true);
		expect(await bag(other)).toEqual(beforeOther);
		expect(await isolated.db.select().from(s.casinoLogs).where(eq(s.casinoLogs.discordId, id))).toHaveLength(1);
	});

	it('rolls back a casino write failure and never publishes a success event', async () => {
		const before = await bag();
		const repo = new CasinoRepository();
		vi.spyOn(repo, 'settle').mockRejectedValue(new Error('settlement failed'));
		await expect(
			new CasinoService(repo, events, { persistence }).play(id, 'coin_toss', 100, 'heads'),
		).rejects.toThrow('settlement failed');
		expect(await bag()).toEqual(before);
		expect(events.emit).not.toHaveBeenCalled();
		expect(local.order).toEqual([]);
	});

	it('replays and recovers casino sessions using the supplied root executor and transaction', async () => {
		const sessions = new CasinoSessionService({ persistence });
		const started = await sessions.start(id, 'crash', 100);
		if (started.status !== 'ok') throw new Error(started.text);
		expect(started.done).toBe(false);
		await isolated.db
			.update(s.activeCasinoSessions)
			.set({ expiresAt: new Date(0) })
			.where(eq(s.activeCasinoSessions.sessionId, started.sessionId));
		await sessions.recoverExpired();
		const settled = await sessions.act(id, started.sessionId, 'cash', 0);
		expect(settled.status === 'ok' && settled.done).toBe(true);
		expect(await isolated.db.select().from(s.casinoLogs).where(eq(s.casinoLogs.discordId, id))).toHaveLength(1);
		expect(await other.db.select().from(s.activeCasinoSessions)).toHaveLength(0);
	});

	it('uses injected battle collaborators, keeps duel lock order and commits default title grants on the same handle', async () => {
		const queries = new DuelRepository();
		const lockDuel = vi.spyOn(queries, 'lockDuel');
		const lockBag = vi.spyOn(queries, 'lockBag');
		const lockCharacter = vi.spyOn(queries, 'lockCharacter');
		const resolve = vi.fn(() => win);
		const defaultFactory = new PlayerCombatantFactory();
		const createCombatant = vi.fn(defaultFactory.createCombatant.bind(defaultFactory));
		const factory = { createCombatant, createStrategy: defaultFactory.createStrategy.bind(defaultFactory) };
		const duels = new DuelService(undefined, undefined, undefined, undefined, events, {
			persistence,
			queries,
			engine: { resolve },
			factory,
		});
		const created = await duels.create(id, opponent, 1_000);
		if (created.status !== 'ok') throw new Error(created.status);
		local.handles.length = 0;
		expect((await duels.accept(created.duelId, opponent)).status).toBe('ok');
		expect(local.handles).toHaveLength(1);
		expect(lockDuel.mock.calls[0][0]).toBe(local.handles[0]);
		expect(lockBag.mock.calls.map(([tx, who]) => [tx === local.handles[0], who])).toEqual([
			[true, id],
			[true, opponent],
		]);
		expect(lockDuel.mock.invocationCallOrder[0]).toBeLessThan(lockBag.mock.invocationCallOrder[0]);
		expect(lockBag.mock.invocationCallOrder[1]).toBeLessThan(lockCharacter.mock.invocationCallOrder[0]);
		expect(resolve).toHaveBeenCalledTimes(1);
		expect(createCombatant).toHaveBeenCalledTimes(2);
		expect((await bag()).credux).toBe(1_001_000);
		expect((await character()).pvpWins).toBe(1);
		expect((await character(other)).pvpWins).toBe(0);
		expect(await isolated.db.select().from(s.userTitles).where(eq(s.userTitles.discordId, id))).toHaveLength(1);
	});

	it('runs default raid progress inside the same transaction and records receipts without duplicate grants', async () => {
		const queries = new RaidRepository();
		const lockBag = vi.spyOn(queries, 'lockBag');
		const lockCharacter = vi.spyOn(queries, 'lockCharacter');
		const raids = new RaidService({
			events,
			persistence,
			queries,
			engine: { resolve: () => win },
		});
		const result = await raids.run(id, false, { requestId: `${id}-raid` });
		expect(result.status).toBe('ok');
		expect(local.handles).toHaveLength(1);
		expect(lockBag.mock.calls[0][0]).toBe(local.handles[0]);
		expect(lockCharacter.mock.calls[0][0]).toBe(local.handles[0]);
		expect(lockBag.mock.invocationCallOrder[0]).toBeLessThan(lockCharacter.mock.invocationCallOrder[0]);
		expect((await character()).believerExp).toBeGreaterThan(0);
		expect((await character(other)).believerExp).toBe(0);
		const before = await bag();
		expect(await raids.run(id, false, { requestId: `${id}-raid` })).toEqual({
			status: 'already-processed',
		});
		expect(await bag()).toEqual(before);
	});

	it('rolls back raid rewards and receipt writes when the injected progress step rejects', async () => {
		const before = await bag();
		const apply = vi.fn().mockRejectedValue(new Error('progress rejected'));
		const raids = new RaidService({
			events,
			persistence,
			engine: { resolve: () => win },
			progress: { apply },
		});
		await expect(raids.run(id, false, { requestId: `${id}-failed` })).rejects.toThrow('progress rejected');
		expect(apply.mock.calls[0][0]).toBe(local.handles[0]);
		expect(await bag()).toEqual(before);
		expect(await isolated.db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(0);
		expect(
			await isolated.db.select().from(s.menuActionReceipts).where(eq(s.menuActionReceipts.discordId, id)),
		).toHaveLength(0);
		expect(events.emit).not.toHaveBeenCalled();
	});

	it('shares supplied persistence through ranked assembly, weekly claims and PvP cosmetic grants', async () => {
		const ranked = new RankedService(undefined, undefined, undefined, events, {
			persistence,
			engine: { resolve: () => win },
		});
		expect((await ranked.fight(id)).status).toBe('ok');
		expect((await ranked.claim(id)).status).toBe('ok');
		expect((await ranked.claim(id)).status).toBe('already-claimed');
		expect(await ranked.stats(id)).not.toEqual(
			await new RankedService(undefined, undefined, undefined, events, { persistence: remote.persistence }).stats(
				id,
			),
		);
		const shop = new PvpShopService(undefined, { persistence });
		expect(await shop.buy(id, 'title_champion')).toContain('Arena Champion');
		expect(await isolated.db.select().from(s.userTitles).where(eq(s.userTitles.discordId, id))).not.toHaveLength(0);
		expect(await other.db.select().from(s.userTitles).where(eq(s.userTitles.discordId, id))).toHaveLength(0);
	});

	it('keeps default loot grants, loadout, sockets and enhancement on the supplied database', async () => {
		const loot = new LootService(undefined, events, { persistence });
		await loot.open(id, 'silver', 1);
		const weapons = await isolated.db.select().from(s.userWeapons).where(eq(s.userWeapons.discordId, id));
		const weapon = weapons.find((row) => row.weaponId !== starter.weaponId)!;
		const loadout = new LoadoutService({ persistence });
		await loadout.equip(id, 'weapon', weapon.weaponId, 2);
		await loadout.switch(id, 2);
		expect((await character()).activePresetSlot).toBe(2);
		expect(
			(
				await isolated.db
					.select()
					.from(s.userPresets)
					.where(and(eq(s.userPresets.discordId, id), eq(s.userPresets.slot, 2)))
			)[0].equippedWeaponId,
		).toBe(weapon.weaponId);
		expect((await character(other)).activePresetSlot).toBe(1);
		const [rune] = await isolated.db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id));
		const sockets = new SocketService(undefined, undefined, { persistence });
		expect(await sockets.equip(id, rune.runeUid, weapon.weaponId, 1)).toEqual({ status: 'ok' });
		expect(await sockets.unequip(id, rune.runeUid)).toEqual({ status: 'ok' });
		expect(
			(await new EnhancementService(undefined, events, { persistence }).attempt(id, weapon.weaponId)).status,
		).toBe('success');
		expect((await bag(other)).silverChest).toBe(10);
		expect(await other.db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id))).toHaveLength(0);
	});

	it.each(['options', 'legacy positional'])(
		'supports %s grant injection and rolls back earlier rewards on failure',
		async (source) => {
			const grants = new LootGrantService();
			const rune = vi.fn(grants.rune.bind(grants));
			const gear = vi.fn().mockRejectedValue(new Error('gear grant rejected'));
			const before = await bag();
			const storage = new LootRepository();
			const legacySource = {
				lockBag: storage.lockBag.bind(storage),
				bags: storage.bags.bind(storage),
				log: storage.log.bind(storage),
				rune,
				gear,
			};
			const loot =
				source === 'options'
					? new LootService(undefined, events, { persistence, grants: { rune, gear } })
					: new LootService(legacySource, events, { persistence });
			await expect(loot.open(id, 'silver', 1)).rejects.toThrow('gear grant rejected');
			expect(rune.mock.calls[0][0]).toBe(local.handles[0]);
			expect(gear.mock.calls[0][0]).toBe(local.handles[0]);
			expect(await bag()).toEqual(before);
			expect(await isolated.db.select().from(s.userRunes).where(eq(s.userRunes.discordId, id))).toHaveLength(0);
			expect(events.emit).not.toHaveBeenCalled();
		},
	);

	it('previews, resets and audits only the explicitly supplied isolated database', async () => {
		const untouched = await new ResetService({ persistence }).countAll();
		const reset = new ResetService({ persistence: remote.persistence });
		const deletedUsers = await reset.countAll();
		expect(deletedUsers).toBeGreaterThan(0);
		expect(await reset.resetAll('developer')).toEqual({ status: 'ok', deletedUsers });
		expect(await reset.countAll()).toBe(0);
		expect(await new ResetService({ persistence }).countAll()).toBe(untouched);
		expect(
			(await other.db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM dev_logs`)).rows[0].count,
		).toBe(1);
	});
});
