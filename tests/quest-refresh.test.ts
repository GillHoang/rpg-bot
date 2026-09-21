import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { and, eq } from 'drizzle-orm';

// Real PostgreSQL SQL/transactions in an isolated in-memory database. No .env,
// Discord token, network connection or production database is read by this suite.
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { UserRepository } from '../src/repositories/UserRepository.js';
import { QUEST_REFRESH_DONE } from '../src/text/quest.js';
import { QuestService } from '../src/services/QuestService.js';
import { DailyCycle } from '../src/utils/dailyCycle.js';
import * as rngModule from '../src/domain/combat/Rng.js';

let id: string;
let sequence = 0;

beforeAll(async () => {
	const { testClient } = await import('../src/db/client.js') as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
}, 30000);
afterAll(async () => {
	await pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	// Deterministic rolls: rng() → 0 always picks the first pool template.
	vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
	id = `test-refresh-${++sequence}`;
	// Quest tests need a registered account, not onboarding with missing seed.
	await db.transaction((tx) => new UserRepository().registerNew(tx, id, id));
});

describe('QuestService.refresh', () => {
	it('keeps completed quests and tops the board back up to 3', async () => {
		const quests = new QuestService();
		const day = DailyCycle.keyAt();

		// rng 0 → raid_win ×5, summon ×3, enhance ×2. Finish only raid_win.
		await quests.view(id);
		for (let i = 0; i < 5; i++) await quests.progress(id, 'raid_win');
		const before = await db
			.select()
			.from(s.dailyQuests)
			.where(and(eq(s.dailyQuests.discordId, id), eq(s.dailyQuests.questDate, day)));
		expect(before).toHaveLength(3);
		expect(before.filter((q) => q.completed)).toHaveLength(1);

		// Refresh: the two unfinished quests reroll, the finished one stays.
		expect(await quests.refresh(id)).not.toContain('/register');
		const after = await db
			.select()
			.from(s.dailyQuests)
			.where(and(eq(s.dailyQuests.discordId, id), eq(s.dailyQuests.questDate, day)));
		expect(after).toHaveLength(3);
		const completed = after.filter((q) => q.completed);
		expect(completed).toHaveLength(1);
		expect(completed[0].questType).toBe('raid_win');
		// Rerolled quests start from zero progress — nothing is lost or pre-completed.
		expect(after.filter((q) => !q.completed).every((q) => q.currentCount === 0)).toBe(true);
	});

	it('allows one refresh per day only', async () => {
		const quests = new QuestService();
		await quests.view(id);
		expect(await quests.refresh(id)).toBe(QUEST_REFRESH_DONE);
		expect(await quests.refresh(id)).toContain('Đã refresh daily hôm nay');
	});
});
