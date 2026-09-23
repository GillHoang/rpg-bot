import { describe, expect, it, vi } from 'vitest';
import type { Executor } from '../src/db/client.js';
import type { MonsterRosterRepository, MonsterRosterRow } from '../src/repositories/MonsterRosterRepository.js';
import type { RaidRewardStore } from '../src/repositories/RaidRewardStore.js';
import type { DeityDataRepository, DeityRosterRow } from '../src/repositories/DeityDataRepository.js';
import { MonsterEncounterService } from '../src/services/MonsterEncounterService.js';
import { RaidRewardService, type RaidRewardGrant } from '../src/services/RaidRewardService.js';
import { DeityService } from '../src/services/DeityService.js';

// The injected repositories must receive this caller-owned executor unchanged.
const executor = Object.freeze({ context: 'caller-transaction' }) as unknown as Executor;
const mob = (patch: Partial<MonsterRosterRow> = {}): MonsterRosterRow => ({
	mobId: 1,
	name: 'Regular',
	mythology: 'Test',
	mobType: 'regular',
	baseHp: 600,
	baseAtk: 100,
	baseDef: 50,
	baseCrit: 5,
	hpPerLevel: 10,
	atkPerLevel: 2,
	defPerLevel: 1,
	skillKey: 'none',
	skillName: '',
	skillDescription: '',
	immunityTags: ['poison'],
	specialFlags: [],
	...patch,
});

function rewardStore() {
	return {
		lockBag: vi.fn<RaidRewardStore['lockBag']>().mockResolvedValue({
			credux: 1000,
			beliefShards: 10,
			lifetimeCreduxEarned: 2000,
			silverChest: 2,
			goldChest: 3,
			bossTreasureChest: 4,
		}),
		lockCharacter: vi.fn<RaidRewardStore['lockCharacter']>().mockResolvedValue({
			combatLevel: 1,
			combatExp: 50,
			lifetimeExp: 100,
			bossKills: 2,
			raidsWon: 3,
			raidsLost: 4,
		}),
		updateCharacter: vi.fn<RaidRewardStore['updateCharacter']>().mockResolvedValue(undefined),
		updateBag: vi.fn<RaidRewardStore['updateBag']>().mockResolvedValue(undefined),
		insertGameLog: vi.fn<RaidRewardStore['insertGameLog']>().mockResolvedValue(undefined),
		insertRaidLog: vi.fn<RaidRewardStore['insertRaidLog']>().mockResolvedValue(undefined),
		currentWinStreak: vi.fn<RaidRewardStore['currentWinStreak']>().mockResolvedValue(0),
	};
}
const grant: RaidRewardGrant = {
	expGain: 400,
	credux: 200,
	shards: 5,
	grantChest: true,
	battleType: 'raid',
	enemyName: 'Regular',
	enemyTier: 'regular',
	outcome: 'player_win',
};
const deity: DeityRosterRow = {
	deityId: 1,
	name: 'One',
	mythology: 'Greek',
	baseAtk: 101,
	baseHp: 1001,
	baseDef: 81,
	blessingName: 'Blessing',
};
function deityData() {
	return {
		listAvailableForTier: vi
			.fn<DeityDataRepository['listAvailableForTier']>()
			.mockResolvedValue([deity, { ...deity, deityId: 2, name: 'Two' }]),
		ownedDeityIds: vi.fn<DeityDataRepository['ownedDeityIds']>().mockResolvedValue(new Set([1])),
		findAssemblyData: vi.fn<DeityDataRepository['findAssemblyData']>().mockResolvedValue({
			baseAtk: 101,
			baseHp: 1001,
			baseDef: 81,
			sigils: 3,
			mythology: 'Greek',
			blessingKey: 'damage',
			blessingScaling: 'scalable',
		}),
		findOwnedProgress: vi.fn<DeityDataRepository['findOwnedProgress']>().mockResolvedValue(null),
		setSigils: vi.fn<DeityDataRepository['setSigils']>().mockResolvedValue(undefined),
		setAscended: vi.fn<DeityDataRepository['setAscended']>().mockResolvedValue(undefined),
		insertNew: vi.fn<DeityDataRepository['insertNew']>().mockResolvedValue(7),
	};
}

describe('MonsterEncounterService', () => {
	it('preserves tier-then-roster RNG order and weighted boundary with regular scaling', async () => {
		const roster = {
			listForEncounter: vi
				.fn<MonsterRosterRepository['listForEncounter']>()
				.mockResolvedValue([
					mob(),
					mob({ mobId: 2, name: 'Small', baseHp: 300 }),
					mob({ mobId: 3, name: 'Elite', mobType: 'elite' }),
				]),
		};
		const rng = vi.fn().mockReturnValueOnce(0.8).mockReturnValueOnce(0.9);
		const service = new MonsterEncounterService(roster);
		expect(await service.pickForLevel(executor, 2, rng)).toEqual({
			name: 'Small',
			hp: 1432,
			atk: 135,
			def: 62,
			crit: 5,
			mobType: 'regular',
			skillKey: 'none',
			immunityTags: ['poison'],
		});
		expect(roster.listForEncounter).toHaveBeenCalledExactlyOnceWith(executor, false);
		expect(rng).toHaveBeenCalledTimes(2);
	});

	it('preserves elite scaling and consumes two rolls even with one eligible row', async () => {
		const roster = {
			listForEncounter: vi
				.fn<MonsterRosterRepository['listForEncounter']>()
				.mockResolvedValue([mob({ mobType: 'elite', name: 'Elite' })]),
		};
		const rng = vi.fn(() => 0.99);
		expect(await new MonsterEncounterService(roster).pickForLevel(executor, 2, rng)).toEqual({
			name: 'Elite',
			hp: 1298,
			atk: 431,
			def: 226,
			crit: 5,
			mobType: 'elite',
			skillKey: 'none',
			immunityTags: ['poison'],
		});
		expect(rng).toHaveBeenCalledTimes(2);
	});

	it('keeps boss scaling, immunity fallback and one roster roll', async () => {
		const roster = {
			listForEncounter: vi
				.fn<MonsterRosterRepository['listForEncounter']>()
				.mockResolvedValue([mob({ mobType: 'boss', skillKey: 'moon_threshold', immunityTags: null })]),
		};
		const rng = vi.fn(() => 0);
		expect(await new MonsterEncounterService(roster).pickForLevel(executor, 10, rng, true)).toEqual({
			name: 'Regular',
			hp: 700,
			atk: 120,
			def: 60,
			crit: 5,
			mobType: 'boss',
			skillKey: 'moon_threshold',
			immunityTags: [],
		});
		expect(roster.listForEncounter).toHaveBeenCalledExactlyOnceWith(executor, true);
		expect(rng).toHaveBeenCalledOnce();
	});

	it('avoids rolls for an empty roster and clamps levels before scaling', async () => {
		const roster = {
			listForEncounter: vi
				.fn<MonsterRosterRepository['listForEncounter']>()
				.mockResolvedValueOnce([])
				.mockResolvedValue([mob()]),
		};
		const rng = vi.fn(() => 0);
		const service = new MonsterEncounterService(roster);
		expect(await service.pickForLevel(executor, 0, rng)).toBeNull();
		expect(rng).not.toHaveBeenCalled();
		expect(await service.pickForLevel(executor, 0, rng)).toMatchObject({ hp: 2400, atk: 198, def: 91 });
	});
});

describe('RaidRewardService', () => {
	it('keeps lock order, multi-level EXP, currency/chest accounting and history writes', async () => {
		const store = rewardStore();
		const result = await new RaidRewardService(store).grant(executor, 'owner', grant);
		expect(result).toEqual({ previousLevel: 1, newLevel: 3, leveledUp: true });
		expect(store.lockBag).toHaveBeenCalledExactlyOnceWith(executor, 'owner');
		expect(store.lockCharacter).toHaveBeenCalledExactlyOnceWith(executor, 'owner');
		expect(store.updateCharacter).toHaveBeenCalledExactlyOnceWith(executor, 'owner', {
			combatLevel: 3,
			combatExp: 100,
			lifetimeExp: 500,
			bossKills: 2,
			raidsWon: 4,
			raidsLost: 4,
		});
		expect(store.updateBag).toHaveBeenCalledExactlyOnceWith(executor, 'owner', {
			credux: 1200,
			beliefShards: 15,
			lifetimeCreduxEarned: 2200,
			silverChest: 3,
		});
		expect(store.insertGameLog).toHaveBeenNthCalledWith(1, executor, {
			discordId: 'owner',
			action: 'Raid',
			previousCredux: 1000,
			updatedCredux: 1200,
		});
		expect(store.insertGameLog).toHaveBeenNthCalledWith(2, executor, {
			discordId: 'owner',
			action: 'Raid',
			itemType: 'silverChest',
			previousChestCount: 2,
			updatedChestCount: 3,
		});
		expect(store.insertRaidLog).toHaveBeenCalledExactlyOnceWith(executor, {
			discordId: 'owner',
			battleType: 'raid',
			enemyName: 'Regular',
			enemyTier: 'regular',
			result: 'win',
			expEarned: 400,
			updatedExp: 100,
			beliefShardsDropped: 5,
			updatedBeliefShards: 15,
			creduxEarned: 200,
			updatedCredux: 1200,
			chestDropped: 'silverChest',
		});
		const order = [
			store.lockBag,
			store.lockCharacter,
			store.updateCharacter,
			store.updateBag,
			store.insertGameLog,
			store.insertRaidLog,
		].map((fn) => fn.mock.invocationCallOrder[0]);
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});

	it('keeps loss history without currency writes and does not subtract negative EXP', async () => {
		const store = rewardStore();
		const result = await new RaidRewardService(store).grant(executor, 'owner', {
			...grant,
			expGain: -20,
			credux: 0,
			shards: 0,
			grantChest: false,
			outcome: 'enemy_win',
		});
		expect(result).toEqual({ previousLevel: 1, newLevel: 1, leveledUp: false });
		expect(store.updateCharacter).toHaveBeenCalledWith(executor, 'owner', {
			combatLevel: 1,
			combatExp: 50,
			lifetimeExp: 100,
			bossKills: 2,
			raidsWon: 3,
			raidsLost: 5,
		});
		expect(store.updateBag).not.toHaveBeenCalled();
		expect(store.insertGameLog).not.toHaveBeenCalled();
		expect(store.insertRaidLog).toHaveBeenCalledWith(
			executor,
			expect.objectContaining({ result: 'loss', expEarned: -20, updatedExp: 50, chestDropped: null }),
		);
	});

	it('tracks boss victories and the selected chest while using each call executor', async () => {
		const store = rewardStore();
		const service = new RaidRewardService(store);
		const other = Object.freeze({ context: 'other-transaction' }) as unknown as Executor;
		await service.grant(executor, 'first', grant);
		await service.grant(other, 'second', {
			...grant,
			boss: true,
			battleType: 'boss',
			enemyTier: 'boss',
			chestField: 'bossTreasureChest',
		});
		expect(store.updateCharacter).toHaveBeenLastCalledWith(
			other,
			'second',
			expect.objectContaining({ bossKills: 3, raidsWon: 3, raidsLost: 4 }),
		);
		expect(store.updateBag).toHaveBeenLastCalledWith(
			other,
			'second',
			expect.objectContaining({ bossTreasureChest: 5 }),
		);
		expect(store.insertRaidLog).toHaveBeenLastCalledWith(
			other,
			expect.objectContaining({ discordId: 'second', battleType: 'boss', chestDropped: 'bossTreasureChest' }),
		);
	});

	it('fails before writes when locked state is missing and propagates persistence failures', async () => {
		const missing = rewardStore();
		missing.lockBag.mockResolvedValue(undefined);
		missing.lockCharacter.mockResolvedValue(undefined);
		await expect(new RaidRewardService(missing).grant(executor, 'owner', grant)).rejects.toThrow(
			'grant: no user_character row for owner',
		);
		expect(missing.updateCharacter).not.toHaveBeenCalled();
		const broken = rewardStore();
		broken.updateBag.mockRejectedValue(new Error('persistence failed'));
		await expect(new RaidRewardService(broken).grant(executor, 'owner', grant)).rejects.toThrow(
			'persistence failed',
		);
		expect(broken.insertGameLog).not.toHaveBeenCalled();
		expect(broken.insertRaidLog).not.toHaveBeenCalled();
	});

	it('uses the complete streak count from the store', async () => {
		const store = rewardStore();
		store.currentWinStreak.mockResolvedValue(51);
		expect(await new RaidRewardService(store).currentWinStreak(executor, 'owner')).toBe(51);
		expect(store.currentWinStreak).toHaveBeenCalledExactlyOnceWith(executor, 'owner');
	});
});

describe('DeityService', () => {
	it('selects uniformly from the supplied tier roster and never rolls for an empty tier', async () => {
		const data = deityData();
		const service = new DeityService(data);
		const rng = vi.fn(() => 0.75);
		expect(await service.pickRandomAvailableForTier(executor, 'Epic', rng)).toEqual({
			...deity,
			deityId: 2,
			name: 'Two',
		});
		expect(data.listAvailableForTier).toHaveBeenCalledExactlyOnceWith(executor, 'Epic');
		expect(rng).toHaveBeenCalledOnce();
		data.listAvailableForTier.mockResolvedValue([]);
		expect(await service.pickRandomAvailableForTier(executor, 'Supreme', rng)).toBeNull();
		expect(rng).toHaveBeenCalledOnce();
	});

	it('computes floored Sigil stats from raw data and retains blessing metadata', async () => {
		const data = deityData();
		const service = new DeityService(data);
		expect(await service.findUserDeityAssemblyInfo(executor, 7)).toEqual({
			currAtk: 65,
			currHp: 650,
			currDef: 52,
			sigils: 3,
			mythology: 'Greek',
			blessingKey: 'damage',
			blessingScaling: 'scalable',
		});
		expect(data.findAssemblyData).toHaveBeenCalledExactlyOnceWith(executor, 7);
		expect(await service.findUserDeityCurrStats(executor, 7)).toEqual({ currAtk: 65, currHp: 650, currDef: 52 });
		data.findAssemblyData.mockResolvedValue(null);
		expect(await service.findUserDeityCurrStats(executor, 8)).toBeNull();
	});

	it('keeps acquisition defaults and forwards ownership/progress writes on the caller transaction', async () => {
		const data = deityData();
		const service = new DeityService(data);
		expect(await service.insertNew(executor, 'owner', deity, '2026-09-21')).toBe(7);
		expect(data.insertNew).toHaveBeenCalledExactlyOnceWith(executor, {
			discordId: 'owner',
			deityId: 1,
			currAtk: 101,
			currHp: 1001,
			currDef: 81,
			enhancement: 1,
			sigils: 0,
			ascended: false,
			lastPullDate: '2026-09-21',
		});
		expect(await service.ownedDeityIds(executor, 'owner')).toEqual(new Set([1]));
		expect(data.ownedDeityIds).toHaveBeenCalledExactlyOnceWith(executor, 'owner');
		await service.findOwnedProgress(executor, 'owner', 7);
		await service.setSigils(executor, 7, 4);
		await service.setAscended(executor, 7);
		expect(data.findOwnedProgress).toHaveBeenCalledExactlyOnceWith(executor, 'owner', 7);
		expect(data.setSigils).toHaveBeenCalledExactlyOnceWith(executor, 7, 4);
		expect(data.setAscended).toHaveBeenCalledExactlyOnceWith(executor, 7);
	});
});
