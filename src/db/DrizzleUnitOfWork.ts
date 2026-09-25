import { randomInt } from 'node:crypto';
import { recordFailure } from '../shared/utils/operationalMetrics.js';
import { AppError } from '../shared/kernel/Result.js';
import type { db, Transaction } from './client.js';
import type { IUnitOfWork } from '../shared/kernel/persistence.js';

/** Adapts the existing Drizzle transaction without changing its lock semantics. */
export class DrizzleUnitOfWork implements IUnitOfWork {
	private readonly maxRetries: number;
	constructor(
		private readonly database: Pick<typeof db, 'transaction'>,
		options: { maxRetries?: number } = {},
	) {
		this.maxRetries = options.maxRetries ?? 3;
	}

	async run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
		let attempt = 0;
		for (;;) {
			try {
				return await this.database.transaction(work);
			} catch (error: unknown) {
				// Business AppErrors (validation, already-claimed, …) are
				// expected control flow, not infrastructure incidents — only
				// count genuine transaction failures toward the metric.
				if (!(error instanceof AppError)) recordFailure('transaction');
				const wrapped = error as { code?: string; cause?: { code?: string } };
				const code = wrapped?.code ?? wrapped?.cause?.code;
				if (code === '40P01') recordFailure('deadlock');
				if (code === '40001') recordFailure('serialization');
				const retryable = code === '40P01' || code === '40001';
				attempt += 1;
				if (!retryable || attempt > this.maxRetries) throw error;
				// Exponential backoff with jitter: 25/50/100ms — keeps lock
				// contention from turning into a thundering herd. Jitter uses
				// crypto randomness (not Math.random: weak PRNGs must not feed
				// retry timing that an adversary could predict).
				const delay = 25 * 2 ** (attempt - 1) + randomInt(0, 10);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}
}
