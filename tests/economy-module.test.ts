import { describe, expect, it, vi } from 'vitest';
import { ClaimDailyUseCase } from '../src/modules/economy/application/ClaimDailyUseCase.js';
import { GetBalanceUseCase } from '../src/modules/economy/application/GetBalanceUseCase.js';
import { createAppContainer } from '../src/app/container.js';
import { PlayerAccount } from '../src/modules/identity/domain/PlayerAccount.js';

function context() {
	return {
		executor: {} as never,
		unitOfWork: { run: vi.fn() },
	};
}

describe('economy module (pilot slice)', () => {
	it('validates empty discordId without touching persistence', async () => {
		const run = vi.fn();
		const usecase = new ClaimDailyUseCase(undefined, undefined, {
			persistence: { executor: {} as never, unitOfWork: { run } },
		});
		const bad = await usecase.execute({ discordId: '' });
		expect(bad.ok).toBe(false);
		expect(run).not.toHaveBeenCalled();
	});

	it('runs one transaction and emits daily.claimed only on success', async () => {
		const tx = {};
		const repo = {
			hasBag: vi.fn(async () => true),
			getDailyState: vi.fn(async () => ({ monthlyStreak: 1, overallStreak: 1, lastDailyClaimDate: '2000-01-01' })),
			applyReward: vi.fn(async () => ({
				creduxAfter: 10,
				beliefShardsAfter: 10,
				chestCountAfter: 1,
				milestoneChestCountAfter: null,
			})),
			updateStreak: vi.fn(async () => {}),
			logCurrencyChange: vi.fn(async () => {}),
			logChestChange: vi.fn(async () => {}),
		};
		const progress = { apply: vi.fn(async () => {}) };
		const emit = vi.fn();
		const run = vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(tx));
		const usecase = new ClaimDailyUseCase(repo as never, { emit } as never, {
			persistence: { executor: {} as never, unitOfWork: { run } as never },
			progress: progress as never,
		});
		const good = await usecase.execute({ discordId: 'u1', now: new Date('2026-01-02T00:00:00+08:00') });
		expect(good.ok).toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
		expect(progress.apply).toHaveBeenCalledTimes(1);
		expect(emit).toHaveBeenCalledExactlyOnceWith(
			'daily.claimed',
			expect.objectContaining({ discordId: 'u1', progressApplied: true }),
		);
		// compat contract used by DailyCommand
		await expect(usecase.claim('u1', new Date('2026-01-03T00:00:00+08:00'))).resolves.toMatchObject({
			status: 'ok',
		});
		expect(run).toHaveBeenCalledTimes(2);
	});

	it('validates empty ids without touching persistence', async () => {
		const usecase = new ClaimDailyUseCase(undefined, { emit: vi.fn() }, { persistence: context() as never });
		await expect(usecase.claim('')).rejects.toThrow();
	});

	it('getBalance returns null for unknown accounts', async () => {
		const usecase = new GetBalanceUseCase(
			{ getAccount: async () => null } as never,
			{ bag: async () => null } as never,
		);
		const result = await usecase.execute({ discordId: 'ghost' });
		expect(result.ok && result.value).toBeNull();
	});

	it('getBalance projects account + bag', async () => {
		const account = new PlayerAccount('u1', 'hero', 1, 0, 'Mage', 100, 5);
		const usecase = new GetBalanceUseCase(
			{ getAccount: async () => account } as never,
			{ bag: async () => ({ credux: 100 }) } as never,
		);
		const result = await usecase.execute({ discordId: 'u1' });
		expect(result.ok && result.value).toMatchObject({ username: 'hero', credux: 100 });
	});

	it('app container exposes the economy module without extra I/O', () => {
		const container = createAppContainer({ persistence: context() as never });
		expect(container.economyModule.claimDaily).toBeInstanceOf(ClaimDailyUseCase);
		expect(container.economyModule.claimDaily).toBe(container.daily);
		expect(container.economyModule.getBalance).toBeInstanceOf(GetBalanceUseCase);
	});
});
