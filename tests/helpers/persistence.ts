import { db } from '../../src/db/client.js';
import { DrizzleUnitOfWork } from '../../src/db/DrizzleUnitOfWork.js';
import type { PersistenceContext } from '../../src/shared/kernel/persistence.js';

/**
 * Explicit test persistence built from the mocked `db/client` (PGlite).
 * Every service must receive its `PersistenceContext` via injection — there
 * is no global fallback (see `shared/kernel/persistence.ts`).
 */
export function testPersistence(): PersistenceContext {
	return { executor: db, unitOfWork: new DrizzleUnitOfWork(db) };
}
