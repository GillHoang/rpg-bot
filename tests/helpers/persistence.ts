import { db } from '../../src/db/client.js';
import { DrizzleUnitOfWork } from '../../src/db/DrizzleUnitOfWork.js';
import type { PersistenceContext } from '../../src/shared/kernel/persistence.js';

/**
 * Explicit test persistence built from the mocked `db/client` (PGlite).
 * New tests must inject this instead of relying on the deprecated
 * `defaultPersistence` global — see `src/db/defaultPersistence.ts`.
 */
export function testPersistence(): PersistenceContext {
	return { executor: db, unitOfWork: new DrizzleUnitOfWork(db) };
}
