import { db } from './client.js';
import type { PersistenceContext } from '../shared/kernel/persistence.js';
import { DrizzleUnitOfWork } from './DrizzleUnitOfWork.js';

/** Compatibility defaults; the composition root may supply a different context.
 * @deprecated New code must receive `PersistenceContext` via constructor
 * injection from `createAppContainer`. This fallback exists only for the
 * legacy zero-arg service constructors used by the PGlite test suites
 * (which mock `db/client`), and will be removed once those suites inject
 * an explicit test context. See `tests/helpers/persistence.ts`.
 */
export const defaultPersistence: PersistenceContext = Object.freeze({
	executor: db,
	unitOfWork: new DrizzleUnitOfWork(db),
});
