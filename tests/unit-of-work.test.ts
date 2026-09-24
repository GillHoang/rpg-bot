import { describe, expect, it, vi } from 'vitest';
import type { db, Transaction } from '../src/db/client.js';
import { DrizzleUnitOfWork } from '../src/db/DrizzleUnitOfWork.js';

describe('Drizzle unit of work contract', () => {
	it('passes the original callback to the adapter and returns only after commit', async () => {
		const tx = { identity: 'caller-transaction' } as unknown as Transaction;
		const order: string[] = [];
		const result = { committed: true };
		const work = vi.fn(async (executor: Transaction) => {
			expect(executor).toBe(tx);
			order.push('work');
			return result;
		});
		const database: Pick<typeof db, 'transaction'> = {
			async transaction(callback) {
				expect(callback).toBe(work);
				order.push('begin');
				const value = await callback(tx);
				order.push('commit');
				return value;
			},
		};
		const actual = await new DrizzleUnitOfWork(database).run(work);
		order.push('returned');
		expect(actual).toBe(result);
		expect(work).toHaveBeenCalledOnce();
		expect(order).toEqual(['begin', 'work', 'commit', 'returned']);
	});

	it('propagates callback failure unchanged after rollback without retrying', async () => {
		const failure = new Error('write rejected');
		const order: string[] = [];
		const work = vi.fn(async () => {
			throw failure;
		});
		const database: Pick<typeof db, 'transaction'> = {
			async transaction(callback) {
				try {
					return await callback({} as Transaction);
				} catch (error) {
					order.push('rollback');
					throw error;
				}
			},
		};
		await expect(new DrizzleUnitOfWork(database).run(work)).rejects.toBe(failure);
		expect(work).toHaveBeenCalledOnce();
		expect(order).toEqual(['rollback']);
	});

	it('propagates commit failure even when the callback completed successfully', async () => {
		const failure = new Error('commit failed');
		const work = vi.fn(async () => 42);
		const database: Pick<typeof db, 'transaction'> = {
			async transaction(callback) {
				await callback({} as Transaction);
				throw failure;
			},
		};
		await expect(new DrizzleUnitOfWork(database).run(work)).rejects.toBe(failure);
		expect(work).toHaveBeenCalledOnce();
	});
});
