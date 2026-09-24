import type { Executor, Transaction } from '../../db/client.js';

/** A use case controls the boundary; the adapter owns commit and rollback. */
export interface IUnitOfWork {
	run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
}

/** Immutable persistence dependencies; never stores a request's transaction. */
export interface PersistenceContext {
	readonly executor: Executor;
	readonly unitOfWork: IUnitOfWork;
}
