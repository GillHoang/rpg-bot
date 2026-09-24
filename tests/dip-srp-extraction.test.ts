import { describe, expect, it } from 'vitest';
import { resolveRatingChange, applyElo } from '../src/modules/pvp/application/RankedRatingService.js';
import { selectGateTier } from '../src/modules/pve/application/RaidGatePolicy.js';
import { fixedClock } from '../src/shared/kernel/clock.js';
import { DrizzleUnitOfWork } from '../src/db/DrizzleUnitOfWork.js';

describe('DIP/SRP extractions', () => {
	it('demotion shield cushions exactly one bracket drop', () => {
		const first = resolveRatingChange(1150, 1050, true);
		expect(first.shieldUsed).toBe(true);
		expect(first.shield).toBe(false);
		const second = resolveRatingChange(first.rating, 1000, first.shield);
		expect(second.shieldUsed).toBe(false);
	});

	it('elo is zero-sum floored at zero', () => {
		expect(applyElo(1000, 1000, 1)).toBeGreaterThan(1000);
		expect(applyElo(0, 2000, 0)).toBe(0);
	});

	it('gate policy rejects locked tiers without DB', () => {
		expect(selectGateTier([0, 0, 0, 0, 0], 1, 99)).toMatchObject({ status: 'portal-locked' });
		const ok = selectGateTier([10, 0, 0, 0, 0], 50);
		expect('tier' in ok).toBe(true);
	});

	it('fixedClock returns a stable instant', () => {
		const at = new Date('2026-01-01T00:00:00Z');
		const clock = fixedClock(at);
		expect(clock.now().getTime()).toBe(at.getTime());
		expect(clock.now()).not.toBe(clock.now());
	});

	it('unit of work retries serialization failures then succeeds', async () => {
		let calls = 0;
		const fake = {
			transaction: async (work: (tx: never) => Promise<string>) => {
				calls += 1;
				if (calls < 3) throw { code: '40001' };
				return work({} as never);
			},
		};
		const uow = new DrizzleUnitOfWork(fake, { maxRetries: 3 });
		await expect(uow.run(async () => 'ok')).resolves.toBe('ok');
		expect(calls).toBe(3);
	});

	it('unit of work gives up after max retries', async () => {
		const fake = {
			transaction: async () => {
				throw { code: '40P01' };
			},
		};
		const uow = new DrizzleUnitOfWork(fake, { maxRetries: 1 });
		await expect(uow.run(async () => 'ok')).rejects.toEqual({ code: '40P01' });
	});
});
