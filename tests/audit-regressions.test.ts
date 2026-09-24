import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { RankedService } from '../src/modules/pvp/application/RankedService.js';
import { RankedRepository } from '../src/modules/pvp/infrastructure/RankedRepository.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
	await new StartService().start('audit-a', 'Alice', 'Knight');
	await new StartService().start('audit-b', 'Bob', 'Knight');
}, 30000);
afterAll(async () => {
	await pool.end();
});

it('no opponent does not leave a committed ranked lock', async () => {
	const queries = new RankedRepository();
	vi.spyOn(queries, 'findOpponentInWindow').mockResolvedValue([]);
	const ranked = new RankedService(undefined, undefined, undefined, undefined, { queries });
	expect(await ranked.fight('audit-a')).toEqual({ status: 'no-opponent' });
	expect(await db.select().from(s.activeRankedFights)).toHaveLength(0);
});

it('locks both bags in ID order before reading both locked character states', async () => {
	const queries = new RankedRepository();
	const order: string[] = [];
	const bag = queries.lockBag.bind(queries);
	const character = queries.lockCharacter.bind(queries);
	vi.spyOn(queries, 'lockBag').mockImplementation(async (tx, id) => {
		order.push(`bag:${id}`);
		return bag(tx, id);
	});
	vi.spyOn(queries, 'lockCharacter').mockImplementation(async (tx, id) => {
		order.push(`character:${id}`);
		return character(tx, id);
	});
	const ranked = new RankedService(undefined, undefined, undefined, undefined, { queries });
	expect((await ranked.fight('audit-b')).status).toBe('ok');
	expect(order.slice(0, 4)).toEqual(['bag:audit-a', 'bag:audit-b', 'character:audit-a', 'character:audit-b']);
	const [opponent] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, 'audit-a'));
	expect(opponent.pvpWins + opponent.pvpLosses).toBeLessThanOrEqual(1);
});

import { QuestService } from '../src/modules/meta/application/QuestService.js';
import { DailyCycle } from '../src/shared/utils/dailyCycle.js';
import { weekWindowAt } from '../src/shared/config/ranked.js';
it('multi-action progress uses quantity, caps targets and rewards completion only once', async () => {
	const now = new Date();
	await db.delete(s.dailyQuests).where(eq(s.dailyQuests.discordId, 'audit-a'));
	await db.delete(s.weeklyQuests).where(eq(s.weeklyQuests.discordId, 'audit-a'));
	await db.insert(s.dailyQuests).values({
		discordId: 'audit-a',
		questDate: DailyCycle.keyAt(now),
		questType: 'summon',
		targetCount: 3,
		rewardCredux: 100,
		rewardBeliefShards: 0,
	});
	await db.insert(s.weeklyQuests).values({
		discordId: 'audit-a',
		questWeek: weekWindowAt(now).key,
		questType: 'summon',
		targetCount: 50,
		rewardCredux: 100,
		rewardValor: 0,
	});
	const quests = new QuestService();
	await quests.progress('audit-a', 'summon', 30);
	const [daily] = await db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, 'audit-a'));
	const [weekly] = await db.select().from(s.weeklyQuests).where(eq(s.weeklyQuests.discordId, 'audit-a'));
	expect(daily.currentCount).toBe(3);
	expect(daily.completed).toBe(true);
	expect(weekly.currentCount).toBe(30);
	const [before] = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a'));
	await quests.progress('audit-a', 'summon', 1);
	const [after] = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a'));
	expect(after.credux).toBe(before.credux);
	await expect(quests.progress('audit-a', 'summon', 0)).rejects.toThrow();
});

import { ClaimDailyUseCase } from '../src/modules/economy/application/ClaimDailyUseCase.js';
it('daily rolls back reward and streak if atomic progress fails', async () => {
	const [before] = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-b'));
	const events = { emit: vi.fn() };
	const daily = new ClaimDailyUseCase(undefined, events, {
		progress: {
			apply: async () => {
				throw new Error('progress failed');
			},
		},
	});
	await expect(daily.claim('audit-b')).rejects.toThrow('progress failed');
	const [after] = await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-b'));
	expect(after).toEqual(before);
	expect(events.emit).not.toHaveBeenCalled();
});

import { ResetRepository } from '../src/modules/system/infrastructure/ResetRepository.js';
import { ResetService } from '../src/modules/system/application/ResetService.js';
it('reset rolls back deleted data if audit cannot be written', async () => {
	const queries = new ResetRepository();
	vi.spyOn(queries, 'insertAudit').mockRejectedValue(new Error('audit failed'));
	await expect(new ResetService({ queries }).resetAll('owner')).rejects.toThrow('audit failed');
	expect(await db.select().from(s.users)).toHaveLength(2);
});

import { InventoryDataRepository } from '../src/modules/progression/infrastructure/InventoryDataRepository.js';
it('starter equipment is selected from the active preset and switches correctly', async () => {
	const inventory = new InventoryDataRepository(db);
	expect((await inventory.searchWeapons('audit-a', ''))[0].equipped).toBe(true);
	expect((await inventory.searchArmors('audit-a', ''))[0].equipped).toBe(true);
	await db.update(s.userCharacter).set({ activePresetSlot: 2 }).where(eq(s.userCharacter.discordId, 'audit-a'));
	expect((await inventory.searchWeapons('audit-a', ''))[0].equipped).toBe(false);
	await db.update(s.userCharacter).set({ activePresetSlot: 1 }).where(eq(s.userCharacter.discordId, 'audit-a'));
});

import { ProfileService } from '../src/modules/identity/application/ProfileService.js';
import { ProfileQueryRepository } from '../src/modules/identity/infrastructure/ProfileQueryRepository.js';
it('profile summary does not assemble stats or fetch loadout', async () => {
	const queries = new ProfileQueryRepository();
	const loadout = vi.spyOn(queries, 'findLoadout');
	const preset = vi.spyOn(queries, 'findPreset');
	const assemble = vi.fn();
	const profile = new ProfileService(undefined, undefined, { assemble }, { queries });
	const result = await profile.get('audit-a', 'summary');
	expect(result.status).toBe('ok');
	expect(loadout).not.toHaveBeenCalled();
	expect(preset).not.toHaveBeenCalled();
	expect(assemble).not.toHaveBeenCalled();
});

import { SeasonService } from '../src/modules/meta/application/SeasonService.js';
it('manual season rollover honors expiry and is idempotent for the expected season', async () => {
	const seasons = new SeasonService();
	const active = await db.transaction((tx) => seasons.ensureActive(tx as never));
	expect(await seasons.rollover(active.seasonId, active.startsAt)).toEqual({ status: 'not-due' });
	const next = await seasons.rollover(active.seasonId, active.endsAt);
	expect(next.status).toBe('ok');
	expect(await seasons.rollover(active.seasonId, active.endsAt)).toEqual({ status: 'stale' });
	expect(await db.select().from(s.seasons).where(eq(s.seasons.isActive, true))).toHaveLength(1);
});

import { RunSummonUseCase } from '../src/modules/progression/application/RunSummonUseCase.js';
import { LootService } from '../src/modules/economy/application/LootService.js';
import { DEITY_SEED } from '../src/modules/progression/seed/deities.js';
import { RUNE_SEED } from '../src/modules/progression/seed/runes.js';
it('actual multi-summon and multi-open commit full quest quantities', async () => {
	await db.insert(s.deityRoster).values(DEITY_SEED);
	await db.insert(s.runeRoster).values(RUNE_SEED.map((r, i) => ({ ...r, runeId: i + 1 })));
	await db.delete(s.dailyQuests).where(eq(s.dailyQuests.discordId, 'audit-b'));
	await db.delete(s.weeklyQuests).where(eq(s.weeklyQuests.discordId, 'audit-b'));
	await db.insert(s.dailyQuests).values(
		['summon', 'open_chest'].map((questType) => ({
			discordId: 'audit-b',
			questType,
			targetCount: 50,
			rewardCredux: 0,
			rewardBeliefShards: 0,
			questDate: DailyCycle.keyAt(),
		})),
	);
	await db.insert(s.weeklyQuests).values(
		['summon', 'open_chest'].map((questType) => ({
			discordId: 'audit-b',
			questType,
			targetCount: 50,
			rewardCredux: 0,
			rewardValor: 0,
			questWeek: weekWindowAt().key,
		})),
	);
	await db.update(s.usersBag).set({ beliefShards: 3000, silverChest: 10 }).where(eq(s.usersBag.discordId, 'audit-b'));
	expect((await new RunSummonUseCase().run('audit-b', 30)).status).toBe('ok');
	await new LootService().open('audit-b', 'silver', 10);
	const daily = await db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, 'audit-b'));
	expect(daily.find((q) => q.questType === 'summon')?.currentCount).toBe(30);
	expect(daily.find((q) => q.questType === 'open_chest')?.currentCount).toBe(10);
	const weekly = await db.select().from(s.weeklyQuests).where(eq(s.weeklyQuests.discordId, 'audit-b'));
	expect(weekly.find((q) => q.questType === 'summon')?.currentCount).toBe(30);
	expect(weekly.find((q) => q.questType === 'open_chest')?.currentCount).toBe(10);
});

import { EventBus } from '../src/shared/kernel/EventBus.js';
import { failureCounts } from '../src/shared/utils/operationalMetrics.js';
it('observer failures do not escape an already committed action', async () => {
	const bus = new EventBus();
	const before = failureCounts().observer;
	const observed = vi.fn();
	bus.on('daily.claimed', () => {
		throw new Error('sync observer');
	});
	bus.on('daily.claimed', async () => {
		throw new Error('async observer');
	});
	bus.on('daily.claimed', observed);
	expect(() => bus.emit('daily.claimed', { discordId: 'audit-a', streak: 1, progressApplied: true })).not.toThrow();
	await Promise.resolve();
	expect(observed).toHaveBeenCalledOnce();
	expect(failureCounts().observer).toBe(before + 2);
});
it('weekly grand can be claimed once in each ISO week-year', async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	try {
		const service = new QuestService();
		for (const date of ['2026-01-01T12:00:00Z', '2027-01-04T12:00:00Z']) {
			vi.setSystemTime(new Date(date));
			await db
				.insert(s.weeklyQuests)
				.values(
					['summon', 'raid_win', 'enhance'].map((questType) => ({
						discordId: 'audit-a',
						questType,
						targetCount: 1,
						currentCount: 1,
						completed: true,
						rewardCredux: 0,
						rewardValor: 0,
						questWeek: weekWindowAt().key,
					})),
				);
			const before = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a')))[0];
			await service.claimWeeklyGrand('audit-a');
			await service.claimWeeklyGrand('audit-a');
			const after = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'audit-a')))[0];
			expect(after.credux).toBe(before.credux + 100000);
			expect(after.diamondChest).toBe(before.diamondChest + 1);
		}
	} finally {
		vi.useRealTimers();
	}
});
