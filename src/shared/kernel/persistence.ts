import type { Executor, Transaction } from '../../db/client.js';
import { AppError } from './Result.js';
import { DI_ERROR_TEXT } from '../ui/text/diagnostics.js';

/** A use case controls the boundary; the adapter owns commit and rollback. */
export interface IUnitOfWork {
	run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
}

/** Immutable persistence dependencies; never stores a request's transaction. */
export interface PersistenceContext {
	readonly executor: Executor;
	readonly unitOfWork: IUnitOfWork;
}

/**
 * DIP guard: services must receive their `PersistenceContext` via constructor
 * injection from `createAppContainer` (production) or an explicit test
 * context. There is no global fallback — a missing context is a wiring bug
 * and fails fast with a coded AppError instead of touching the wrong DB.
 */
export function requirePersistence(
	options: { persistence?: PersistenceContext } | undefined,
	service: string,
): PersistenceContext {
	const provided = options?.persistence;
	if (provided) return provided;
	throw new AppError('DI_MISSING_PERSISTENCE', DI_ERROR_TEXT.missingPersistence(service));
}
