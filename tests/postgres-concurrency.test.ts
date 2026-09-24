import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
vi.mock('../src/db/client.js', () => ({ db: {}, pool: {} }));
import * as s from '../src/db/schema.js';
import { DrizzleUnitOfWork } from '../src/db/DrizzleUnitOfWork.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { ClaimDailyUseCase } from '../src/modules/economy/application/ClaimDailyUseCase.js';
import { RankedService } from '../src/modules/pvp/application/RankedService.js';
import { RaidService } from '../src/modules/pve/application/RaidService.js';
import { CasinoService } from '../src/modules/casino/application/CasinoService.js';
import { CasinoGameRegistry } from '../src/modules/casino/domain/CasinoGameRegistry.js';
import { RankedRepository } from '../src/modules/pvp/infrastructure/RankedRepository.js';
import { ResetService } from '../src/modules/system/application/ResetService.js';
import { ResetRepository } from '../src/modules/system/infrastructure/ResetRepository.js';
import { SeasonService } from '../src/modules/meta/application/SeasonService.js';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { MOB_SEED } from '../src/modules/pve/seed/mobs.js';
import type { PersistenceContext } from '../src/shared/kernel/persistence.js';

// Only an explicitly supplied disposable test server may be used; never DATABASE_URL/.env.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgreSQL multi-connection transactions', () => {
	let admin: Pool;
	let pool: Pool;
	let db: ReturnType<typeof drizzle<typeof s>>;
	let persistence: PersistenceContext;
	let start: StartService;
	const schemaName = 'credd_audit_' + randomUUID().replaceAll('-', '');
	let created = false;
	beforeAll(async () => {
		const target = new URL(url!);
		if (!/test/i.test(target.pathname)) throw new Error('TEST_DATABASE_URL must name a disposable test database');
		admin = new Pool({ connectionString: target.toString(), max: 1, connectionTimeoutMillis: 8000 });
		await admin.query('CREATE SCHEMA "' + schemaName + '"');
		created = true;
		pool = new Pool({
			connectionString: target.toString(),
			max: 8,
			options: '-c statement_timeout=10000 -c lock_timeout=5000 -c search_path=' + schemaName,
			connectionTimeoutMillis: 8000,
		});
		db = drizzle(pool, { schema: s });
		// All connections use only this schema (no public fallback). Rebind generated FK schema qualifiers.
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			for (const migration of readMigrationFiles({ migrationsFolder: 'src/db/migrations' })) {
				for (const statement of migration.sql)
					await client.query(statement.replaceAll('"public".', '"' + schemaName + '".'));
			}
			await client.query('COMMIT');
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
		persistence = { executor: db, unitOfWork: new DrizzleUnitOfWork(db) };
		start = new StartService(undefined, undefined, undefined, undefined, undefined, { persistence });
		await db.insert(s.weaponRoster).values(WEAPON_SEED);
		await db.insert(s.armorRoster).values(ARMOR_SEED);
		await db.insert(s.mobRoster).values(MOB_SEED);
	}, 120000);
	afterAll(async () => {
		await pool?.end();
		// Only the random schema created by this suite is dropped.
		if (created && /^credd_audit_[a-f0-9]{32}$/.test(schemaName))
			await admin.query('DROP SCHEMA "' + schemaName + '" CASCADE');
		await admin?.end();
	});
	beforeEach(async () => {
		vi.restoreAllMocks();
		await new ResetService({ persistence }).resetAll('test-owner');
		await Promise.all(['a', 'b', 'c'].map((id) => start.start(id, id, 'Knight')));
	});
	const win = () =>
		vi.spyOn(BattleEngine.prototype, 'resolve').mockReturnValue({
			outcome: 'player_win',
			rounds: 1,
			log: [],
			roundLogs: [],
			playerHpRemaining: 100,
			enemyHpRemaining: 0,
		});
	const character = async (id: string) =>
		(await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id)))[0];
	function pairedSelection(targetFor: (id: string) => string) {
		const queries = new RankedRepository();
		let arrivals = 0;
		let release!: () => void;
		const ready = new Promise<void>((resolve) => {
			release = resolve;
		});
		vi.spyOn(queries, 'findOpponentInWindow').mockImplementation(async (tx, id) => {
			const target = targetFor(id);
			const rows = await tx
				.select()
				.from(s.userCharacter)
				.innerJoin(s.users, eq(s.users.discordId, s.userCharacter.discordId))
				.where(eq(s.userCharacter.discordId, target));
			if (++arrivals === 2) release();
			await ready;
			return rows;
		});
		return new RankedService(undefined, undefined, undefined, undefined, { persistence, queries });
	}
	it('claims daily exactly once under simultaneous requests', async () => {
		const daily = new ClaimDailyUseCase(undefined, undefined, { persistence });
		const results = await Promise.all([daily.claim('a'), daily.claim('a')]);
		expect(results.map((r) => r.status).sort()).toEqual(['already-claimed', 'ok']);
		expect((await db.select().from(s.users).where(eq(s.users.discordId, 'a')))[0].overallStreak).toBe(1);
	});
	it('does not spend the final casino balance twice', async () => {
		await db.update(s.usersBag).set({ credux: 100 }).where(eq(s.usersBag.discordId, 'a'));
		vi.spyOn(CasinoGameRegistry, 'get').mockReturnValue({
			key: 'coin_toss',
			play: () => ({ won: false, payout: 0, result: 'lose', metadata: {} }),
		});
		const casino = new CasinoService(undefined, undefined, { persistence });
		const results = await Promise.all([casino.play('a', 'coin_toss', 100), casino.play('a', 'coin_toss', 100)]);
		expect(results.map((r) => r.status).sort()).toEqual(['insufficient-credux', 'ok']);
		expect((await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'a')))[0].credux).toBe(0);
	});
	it('preserves both losses and rating updates when two fighters select the same opponent', async () => {
		win();
		const ranked = pairedSelection(() => 'c');
		const results = await Promise.all([ranked.fight('a'), ranked.fight('b')]);
		expect(results.every((r) => r.status === 'ok')).toBe(true);
		expect((await character('c')).pvpLosses).toBe(2);
		const logs = await db
			.select()
			.from(s.rankedLogs)
			.where(eq(s.rankedLogs.playerId, 'c'))
			.orderBy(s.rankedLogs.id);
		expect(logs).toHaveLength(2);
		expect(logs[1].ratingBefore).toBe(logs[0].ratingAfter);
		expect((await character('c')).pvpRating).toBe(logs[1].ratingAfter);
	});
	it('settles crossed ranked matches without deadlock', async () => {
		win();
		const ranked = pairedSelection((id) => (id === 'a' ? 'b' : 'a'));
		expect((await Promise.all([ranked.fight('a'), ranked.fight('b')])).every((r) => r.status === 'ok')).toBe(true);
		expect((await character('a')).pvpWins + (await character('a')).pvpLosses).toBe(2);
	});
	it('serializes ranked, raid and repeated ranked requests on the same player', async () => {
		win();
		const ranked = new RankedService(undefined, undefined, undefined, undefined, { persistence });
		const raid = new RaidService({ persistence });
		const results = await Promise.all([ranked.fight('a'), raid.run('a'), ranked.fight('a')]);
		expect(results.every((r) => r.status === 'ok')).toBe(true);
		expect(await db.select().from(s.activeRankedFights)).toHaveLength(0);
	});
	it('creates one active season across independent transactions', async () => {
		await db.execute(sql`TRUNCATE seasons CASCADE`);
		const seasons = new SeasonService(persistence);
		const results = await Promise.all(
			Array.from({ length: 4 }, () => persistence.unitOfWork.run((tx) => seasons.ensureActive(tx))),
		);
		expect(new Set(results.map((s) => s.seasonId)).size).toBe(1);
		expect(await db.select().from(s.seasons).where(eq(s.seasons.isActive, true))).toHaveLength(1);
	});
	it('rolls reset back when audit fails and serializes reset against registration', async () => {
		const queries = new ResetRepository();
		vi.spyOn(queries, 'insertAudit').mockRejectedValueOnce(new Error('audit failure'));
		await expect(new ResetService({ persistence, queries }).resetAll('owner')).rejects.toThrow('audit failure');
		expect(await db.select().from(s.users)).toHaveLength(3);
		const [reset, registered] = await Promise.all([
			new ResetService({ persistence }).resetAll('owner'),
			start.start('new', 'New', 'Knight'),
		]);
		expect(registered.status).toBe('ok');
		expect(reset.status).toBe('ok');
		const remaining = await db.select().from(s.users);
		if (reset.status === 'ok') expect(reset.deletedUsers + remaining.length).toBe(4);
	});
});
