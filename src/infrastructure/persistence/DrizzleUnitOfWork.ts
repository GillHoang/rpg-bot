import type { db, Transaction } from '../../db/client.js';
import type { IUnitOfWork } from '../../application/ports/PersistenceContext.js';

/** Adapts the existing Drizzle transaction without changing its lock semantics. */
export class DrizzleUnitOfWork implements IUnitOfWork {
	constructor(private readonly database: Pick<typeof db, 'transaction'>) {}

	run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
		return this.database.transaction(work);
	}
}
