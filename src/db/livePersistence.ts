import { db } from './client.js';
import { DrizzleUnitOfWork } from './DrizzleUnitOfWork.js';
import type { PersistenceContext } from '../shared/kernel/persistence.js';

/**
 * Production live context (NOT deprecated): the composition root and CLI
 * scripts wire this explicitly. Unlike `defaultPersistence`, this factory
 * makes the live-database choice visible at the call site instead of hiding
 * it behind a shared global — new code must call this (or receive a context
 * via injection), never the deprecated alias.
 */
export function createLivePersistence(): PersistenceContext {
	return { executor: db, unitOfWork: new DrizzleUnitOfWork(db) };
}
