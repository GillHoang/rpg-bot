import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ db: {}, pool: {} }));

import { CasinoSessionService } from '../src/modules/casino/application/CasinoSessionService.js';
import { DrizzleUnitOfWork } from '../src/db/DrizzleUnitOfWork.js';

/**
 * MAJOR regression test: DrizzleUnitOfWork re-runs the whole `work` closure
 * on deadlock/serialization errors. CasinoSessionService.act must therefore
 * build the next game state on a copy — a retried run must never push the
 * same action twice into the replay log.
 */
describe('casino session retry purity', () => {
	it('does not duplicate the pushed action when the first commit hits 40001', async () => {
		const persisted = {
			sessionId: 's1',
			discordId: 'u1',
			game: 'crash',
			status: 'active',
			betAmount: 100,
			balanceBefore: 1000,
			balanceAfterDebit: 900,
			stateJson: { seed: 1, actions: [] as string[] },
			expiresAt: new Date(Date.now() + 60000),
			payout: null,
		};
		const seenActionLengths: number[] = [];
		let committedState = { seed: 1, actions: [] as string[] };
		let committedStatus = 'active';
		let staged: { stateJson: typeof committedState; status?: string } | null = null;
		const baseSession = {
			sessionId: 's1',
			discordId: 'u1',
			game: 'crash',
			betAmount: 100,
			balanceBefore: 1000,
			balanceAfterDebit: 900,
			expiresAt: new Date(Date.now() + 60000),
			payout: null,
		};
		const queries = {
			lockBag: vi.fn(async () => [{}]),
			lockOwnedSession: vi.fn(async () => [
				{
					...baseSession,
					status: committedStatus,
					stateJson: JSON.parse(JSON.stringify(committedState)),
				},
			]),
			updateSession: vi.fn(async (_tx: unknown, _id: string, patch: typeof staged) => {
				seenActionLengths.push(patch!.stateJson.actions.length);
				staged = patch;
			}),
			findBag: vi.fn(async () => [{ credux: 900 }]),
			updateBag: vi.fn(async () => {}),
			insertLog: vi.fn(async () => {}),
		};
		let commits = 0;
		const database = {
			transaction: async (work: (tx: unknown) => Promise<unknown>) => {
				const result = await work({});
				commits += 1;
				// Simulate a serialization failure AFTER the work ran (commit conflict):
				// the first attempt's writes roll back, only the retry commits.
				if (commits === 1) {
					staged = null;
					throw { code: '40001' };
				}
				committedState = staged!.stateJson;
				if (staged!.status) committedStatus = staged!.status;
				return result;
			},
		};
		const service = new CasinoSessionService({
			persistence: {
				executor: {} as never,
				unitOfWork: new DrizzleUnitOfWork(database as never, { maxRetries: 3 }),
			},
			progress: { apply: vi.fn() },
			queries: queries as never,
		});

		const result = await service.act('u1', 's1', 'cash');
		expect(result.status).toBe('ok');
		// Both attempts pushed exactly one action; the retry re-read a clean log.
		expect(seenActionLengths).toEqual([1, 1]);
		expect(committedState.actions).toEqual(['cash']);
		expect(committedStatus).toBe('settled');
	});
});
