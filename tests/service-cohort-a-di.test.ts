import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PersistenceContext } from '../src/shared/kernel/persistence.js';
import type { Transaction } from '../src/db/client.js';
import { createTestDatabase, migrateTestDatabase } from './helpers/database.js';
import { textOf } from './helpers/result.js';
import * as s from '../src/db/schema.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { ProfileService } from '../src/modules/identity/application/ProfileService.js';
import { ClaimDailyUseCase } from '../src/modules/economy/application/ClaimDailyUseCase.js';
import { EconomyService } from '../src/modules/economy/application/EconomyService.js';
import { QuestService } from '../src/modules/meta/application/QuestService.js';
import { ReputationService } from '../src/modules/meta/application/ReputationService.js';
import { CosmeticService } from '../src/modules/meta/application/CosmeticService.js';
import { ClassChangeService } from '../src/modules/identity/application/ClassChangeService.js';
import { RunSummonUseCase } from '../src/modules/progression/application/RunSummonUseCase.js';
import { AscensionService } from '../src/modules/progression/application/AscensionService.js';
import { GameplayProgressCoordinator } from '../src/shared/progress/gameplayProgress.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { DEITY_SEED } from '../src/modules/progression/seed/deities.js';
import { COSMETIC_SEED } from '../src/modules/meta/seed/cosmetics.js';
import { TITLE_SEED } from '../src/modules/meta/seed/titles.js';
import { believerLevelCost } from '../src/shared/config/reputation.js';
import { DailyCycle } from '../src/shared/utils/dailyCycle.js';
import * as rngModule from '../src/modules/combat-shared/domain/Rng.js';

// A service falling back to the global database fails immediately; no real pool exists.
vi.mock('../src/db/client.js', () => ({
	db: new Proxy(
		{},
		{
			get: () => {
				throw new Error('Unexpected global database access');
			},
		},
	),
}));

const isolated = createTestDatabase();
const other = createTestDatabase();
function contextFor(database: typeof isolated): PersistenceContext {
	return {
		executor: database.db as unknown as PersistenceContext['executor'],
		unitOfWork: {
			run: (work) => database.db.transaction((tx) => work(tx as unknown as Transaction)),
		},
	};
}
const persistence = contextFor(isolated);
let id: string;
let sequence = 0;
const bag = async () => (await isolated.db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0];

beforeAll(async () => {
	await migrateTestDatabase(isolated.testClient);
	await migrateTestDatabase(other.testClient);
	await isolated.db.insert(s.weaponRoster).values(WEAPON_SEED);
	await isolated.db.insert(s.armorRoster).values(ARMOR_SEED);
	await isolated.db.insert(s.deityRoster).values(DEITY_SEED);
	await isolated.db.insert(s.cosmeticCatalog).values(COSMETIC_SEED.map((row) => ({ ...row, isActive: true })));
	await isolated.db.insert(s.titleCatalog).values(TITLE_SEED);
}, 120000);

afterAll(async () => {
	await isolated.pool.end();
	await other.pool.end();
});

beforeEach(async () => {
	vi.restoreAllMocks();
	vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
	id = `cohort-a-${++sequence}`;
	const start = new StartService(undefined, undefined, undefined, undefined, undefined, { persistence });
	expect((await start.start(id, id, 'Knight')).status).toBe('ok');
});

describe('service cohort A persistence isolation', () => {
	it('propagates custom persistence through default onboarding, profile and stat assembly collaborators', async () => {
		const profile = new ProfileService(undefined, undefined, undefined, { persistence });
		const result = await profile.get(id);
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error(result.status);
		expect(result.data.username).toBe(id);
		expect(result.data.combatClass).toBe('Knight');
		expect(result.data.stats.hp).toBeGreaterThan(0);
		expect(result.data.beliefShards).toBe(1000);
		expect(result.data.loadout?.weapon?.name).toBe("Initiate's Blade");
		expect(result.data.loadout?.armor?.name).toBe("Initiate's Garb");
		expect(result.data.loadout?.deities).toEqual([]);
		const separate = new ProfileService(undefined, undefined, undefined, { persistence: contextFor(other) });
		expect(await separate.get(id)).toEqual({ status: 'not-registered' });
		expect((await profile.get(id)).status).toBe('ok');
		expect(
			await isolated.db.select().from(s.equippedSkins).where(eq(s.equippedSkins.discordId, id)),
		).not.toHaveLength(0);
	});

	it('commits daily rewards and default quest/reputation progress together without a nested unit of work', async () => {
		const run = vi.spyOn(persistence.unitOfWork, 'run');
		const emit = vi.fn();
		const service = new ClaimDailyUseCase(undefined, { emit }, { persistence });
		expect((await service.claim(id, new Date())).status).toBe('ok');
		expect(run).toHaveBeenCalledTimes(1);
		expect(emit).toHaveBeenCalledExactlyOnceWith(
			'daily.claimed',
			expect.objectContaining({ discordId: id, progressApplied: true }),
		);
		const [character] = await isolated.db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(character.believerExp).toBeGreaterThanOrEqual(50);
		expect(await isolated.db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, id))).toHaveLength(3);
		expect((await service.claim(id, new Date())).status).toBe('already-claimed');
		expect(emit).toHaveBeenCalledTimes(1);
	});

	it('rolls back daily rewards, streak and earlier quest writes when the injected progress collaborator rejects', async () => {
		const before = await bag();
		const emit = vi.fn();
		const progress = new GameplayProgressCoordinator({
			persistence,
			reputation: { awardInTx: vi.fn().mockRejectedValue(new Error('progress rejected')) },
		});
		const service = new ClaimDailyUseCase(undefined, { emit }, { persistence, progress });
		await expect(service.claim(id, new Date())).rejects.toThrow('progress rejected');
		expect(await bag()).toEqual(before);
		const [user] = await isolated.db.select().from(s.users).where(eq(s.users.discordId, id));
		expect(user.lastDailyClaimDate).toBeNull();
		expect(await isolated.db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, id))).toHaveLength(0);
		expect(emit).not.toHaveBeenCalled();
	});

	it('keeps InTx progress on the caller transaction and stops after a failed quest step', async () => {
		const run = vi.spyOn(persistence.unitOfWork, 'run');
		const now = new Date('2026-09-21T00:00:00Z');
		const progressInTx = vi.fn().mockRejectedValue(new Error('quest failed'));
		const awardInTx = vi.fn();
		const coordinator = new GameplayProgressCoordinator({
			persistence,
			quests: { progressInTx },
			reputation: { awardInTx },
		});
		await isolated.db.transaction(async (tx) => {
			await expect(coordinator.apply(tx as unknown as Transaction, id, 'raid_win', now)).rejects.toThrow(
				'quest failed',
			);
			expect(progressInTx).toHaveBeenCalledExactlyOnceWith(tx, id, 'raid_win', now, 1);
		});
		expect(awardInTx).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
	});

	it('awards level-up titles using the caller transaction and default cosmetic collaborator', async () => {
		await isolated.db
			.update(s.userCharacter)
			.set({ believerLevel: 9, believerExp: believerLevelCost(9) - 1 })
			.where(eq(s.userCharacter.discordId, id));
		const run = vi.spyOn(persistence.unitOfWork, 'run');
		const reputation = new ReputationService({ persistence });
		await isolated.db.transaction(async (tx) => {
			expect(await reputation.awardInTx(tx as unknown as Transaction, id, 'daily')).toEqual({
				granted: 50,
				newLevel: 10,
			});
		});
		expect(run).not.toHaveBeenCalled();
		const cosmetics = new CosmeticService({ persistence });
		const titles = await isolated.db.select().from(s.userTitles).where(eq(s.userTitles.discordId, id));
		expect(titles).toHaveLength(1);
		await cosmetics.equipTitle(id, titles[0].titleId);
		const profile = await new ProfileService(undefined, undefined, undefined, { persistence }).get(id);
		expect(profile.status === 'ok' && profile.data.title).toBeTruthy();
	});

	it('uses the injected account repository executor and emits currency events only after commit', async () => {
		const order: string[] = [];
		const observed: PersistenceContext = {
			executor: persistence.executor,
			unitOfWork: {
				run: async (work) => {
					const result = await persistence.unitOfWork.run(work);
					order.push('committed');
					return result;
				},
			},
		};
		const emit = vi.fn(() => {
			order.push('event');
		});
		const economy = new EconomyService(undefined, { emit }, { persistence: observed });
		const before = await bag();
		await economy.grantCurrency(id, 25, 'test');
		expect(order).toEqual(['committed', 'event']);
		expect((await bag()).credux).toBe(before.credux + 25);
		await expect(economy.grantCurrency(id, -1, 'test')).rejects.toThrow('positive integer');
		expect(emit).toHaveBeenCalledTimes(1);
	});

	it('preserves class-change token policy inside the injected transaction', async () => {
		await isolated.db.update(s.usersBag).set({ changeClass: 1 }).where(eq(s.usersBag.discordId, id));
		const service = new ClassChangeService({ persistence });
		await service.change(id, 'Mage');
		const [character] = await isolated.db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(character.class).toBe('Mage');
		expect((await bag()).changeClass).toBe(0);
		await service.change(id, 'Archer');
		expect(
			(await isolated.db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id)))[0].class,
		).toBe('Mage');
	});

	it('preserves summon debit, duplicate essence and sigil payment through named repositories', async () => {
		const emit = vi.fn();
		const summon = new RunSummonUseCase(undefined, undefined, { emit }, { persistence });
		const first = await summon.run(id, 1);
		expect(first.status).toBe('ok');
		const second = await summon.run(id, 1);
		expect(second.status === 'ok' && second.pulls[0].isDupe).toBe(true);
		expect((await bag()).beliefShards).toBe(800);
		expect((await bag()).epicEssence).toBe(1);
		const [deity] = await isolated.db.select().from(s.userDeities).where(eq(s.userDeities.discordId, id));
		await isolated.db.update(s.usersBag).set({ epicEssence: 5 }).where(eq(s.usersBag.discordId, id));
		const ascension = new AscensionService(undefined, { persistence });
		expect(await ascension.addSigil(id, deity.userDeityId)).toEqual({ status: 'ok', newSigils: 1 });
		expect((await bag()).epicEssence).toBe(0);
		expect(await ascension.ascend(id, deity.userDeityId)).toEqual({ status: 'not-enough-sigils', have: 1 });
		expect(emit).toHaveBeenCalledTimes(2);
	});

	it('rejects stale quest refreshes without charging the current injected account', async () => {
		const quests = new QuestService(undefined, { persistence });
		await quests.snapshot(id);
		const before = await isolated.db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, id));
		expect(textOf(await quests.refresh(id, '1999-01-01'))).not.toContain('/register');
		expect(await isolated.db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, id))).toEqual(before);
		expect((await quests.snapshot(id))?.day).toBe(DailyCycle.keyAt());
	});
});
