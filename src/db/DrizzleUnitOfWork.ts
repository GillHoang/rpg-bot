import { recordFailure } from '../shared/utils/operationalMetrics.js';
import type { db, Transaction } from './client.js';
import type { IUnitOfWork } from '../shared/kernel/persistence.js';

/** Adapts the existing Drizzle transaction without changing its lock semantics. */
export class DrizzleUnitOfWork implements IUnitOfWork {
	constructor(private readonly database: Pick<typeof db, 'transaction'>) {}

	run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
		return this.database.transaction(work).catch((error: unknown) => {
			recordFailure('transaction');
			const wrapped = error as { code?: string; cause?: { code?: string } };
			const code = wrapped?.code ?? wrapped?.cause?.code;
			if (code === '40P01') recordFailure('deadlock');
			if (code === '40001') recordFailure('serialization');
			throw error;
		});
	}
}
