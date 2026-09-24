import { describe, expect, it, vi } from 'vitest';
import { RunSummonUseCase } from '../src/modules/progression/application/RunSummonUseCase.js';
import { createAppContainer } from '../src/app/container.js';

function context() {
	return { executor: {} as never, unitOfWork: { run: vi.fn() } };
}

const bag = {
	beliefShards: 10_000,
	sacredRelics: 0,
	supremeRelics: 0,
	epicEssence: 0,
	mythicEssence: 0,
	legendaryEssence: 0,
	supremeEssence: 0,
};

function okDeps(overrides: Record<string, unknown> = {}) {
	const tx = {};
	const queries = {
		lockBag: vi.fn(async () => [{ ...bag }]),
		findPity: vi.fn(async () => []),
		lockCharacter: vi.fn(async () => [{ activePresetSlot: 1 }]),
		findPreset: vi.fn(async () => []),
		insertShardLog: vi.fn(async () => {}),
		upsertPity: vi.fn(async () => {}),
		updatePresetDeity: vi.fn(async () => {}),
		updateRelicBalance: vi.fn(async () => {}),
		insertRelicGrant: vi.fn(async () => {}),
		updateShardBalance: vi.fn(async () => {}),
		insertEssenceLog: vi.fn(async () => {}),
		updateEssenceBalances: vi.fn(async () => {}),
	};
	const deities = {
		ownedDeityIds: vi.fn(async () => new Set<number>()),
		pickRandomAvailableForTier: vi.fn(async () => ({
			deityId: 1,
			name: 'Zeus',
			mythology: 'Olympus',
			blessingName: 'Storm',
		})),
		insertNew: vi.fn(async () => 42),
	};
	const run = vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(tx));
	const emit = vi.fn();
	const usecase = new RunSummonUseCase(
		{ hasCharacter: async () => true } as never,
		deities as never,
		{ emit } as never,
		{
			persistence: { executor: {} as never, unitOfWork: { run } as never },
			progress: { apply: vi.fn(async () => {}) } as never,
			queries: { ...queries, ...(overrides.queries as object | undefined) } as never,
		},
	);
	return { usecase, queries, deities, run, emit };
}

describe('progression summon module', () => {
	it('rejects invalid counts and empty ids without touching persistence', async () => {
		const run = vi.fn();
		const usecase = new RunSummonUseCase(undefined, undefined, undefined, {
			persistence: { executor: {} as never, unitOfWork: { run } as never },
		});
		expect(await usecase.execute({ discordId: '', count: 1 })).toMatchObject({ ok: false });
		expect(await usecase.execute({ discordId: 'u1', count: 0 })).toEqual({
			ok: true,
			value: { status: 'invalid-count' },
		});
		expect(run).not.toHaveBeenCalled();
	});

	it('runs one transaction and emits summon.done on success', async () => {
		const { usecase, run, emit, queries } = okDeps();
		const result = await usecase.execute({ discordId: 'u1', count: 1 });
		expect(result).toMatchObject({ ok: true, value: { status: 'ok' } });
		if (!result.ok || result.value.status !== 'ok') throw new Error('expected ok');
		expect(result.value.pulls).toHaveLength(1);
		expect(result.value.pulls[0]).toMatchObject({ name: 'Zeus', isDupe: false });
		expect(run).toHaveBeenCalledTimes(1);
		expect(queries.updateShardBalance).toHaveBeenCalledTimes(1);
		expect(emit).toHaveBeenCalledExactlyOnceWith(
			'summon.done',
			expect.objectContaining({ discordId: 'u1', count: 1, progressApplied: true }),
		);
		// compat contract used by SummonCommand
		await expect(usecase.run('u1', 1)).resolves.toMatchObject({ status: 'ok' });
		expect(run).toHaveBeenCalledTimes(2);
	});

	it('returns insufficient-shards without mutating', async () => {
		const { usecase, emit, queries } = okDeps({
			queries: { lockBag: async () => [{ ...bag, beliefShards: 0 }] },
		});
		const result = await usecase.execute({ discordId: 'u1', count: 1 });
		expect(result).toEqual({ ok: true, value: { status: 'insufficient-shards', needed: 100, have: 0 } });
		expect(queries.updateShardBalance).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});

	it('validates empty ids without touching persistence', async () => {
		const usecase = new RunSummonUseCase(undefined, undefined, { emit: vi.fn() }, {
			persistence: context() as never,
		});
		await expect(usecase.run('', 1)).rejects.toThrow();
	});

	it('app container exposes the progression module without extra I/O', () => {
		const container = createAppContainer({ persistence: context() as never });
		expect(container.progressionModule.runSummon).toBeInstanceOf(RunSummonUseCase);
		expect(container.progressionModule.runSummon).toBe(container.summon);
	});
});
