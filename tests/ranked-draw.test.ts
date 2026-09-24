import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { RankedService } from '../src/modules/pvp/application/RankedService.js';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';

let id: string;
let opponent: string;
let sequence = 0;

beforeAll(async () => {
	const { testClient } = await import('../src/db/client.js') as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
}, 120000);
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `test-draw-${++sequence}`;
	opponent = `test-draw-${++sequence}-opponent`;
	const me = await new StartService().start(id, id, 'Knight');
	const foe = await new StartService().start(opponent, opponent, 'Knight');
	if (me.status !== 'ok' || foe.status !== 'ok') throw new Error('start flow failed');
});

describe('RankedService draw handling', () => {
	// A synthetic draw outcome keeps the test deterministic — RankedService only
	// reads `battle.outcome` for the W/L bookkeeping under test here.
	function forceDraw(): void {
		vi.spyOn(BattleEngine.prototype, 'resolve').mockImplementation(() => ({
			outcome: 'draw',
			rounds: 1,
			log: [],
			roundLogs: [],
			playerHpRemaining: 1,
			enemyHpRemaining: 1,
		}));
	}

	it('a draw gives neither fighter a win or a loss', async () => {
		forceDraw();
		const ranked = new RankedService();
		const result = await ranked.fight(id);
		if (result.status !== 'ok') throw new Error(`ranked failed: ${result.status}`);
		expect(result.draw).toBe(true);

		const [me] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		const [foe] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, opponent));
		expect(me.pvpWins).toBe(0);
		expect(me.pvpLosses).toBe(0);
		expect(foe.pvpWins).toBe(0);
		expect(foe.pvpLosses).toBe(0);

		const logs = await db.select().from(s.rankedLogs);
		expect(logs).toHaveLength(2);
		expect(logs.every((l) => l.result === 'draw')).toBe(true);
	});
});
