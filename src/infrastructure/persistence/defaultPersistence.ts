import { db } from '../../db/client.js';
import type { PersistenceContext } from '../../application/ports/PersistenceContext.js';
import { DrizzleUnitOfWork } from './DrizzleUnitOfWork.js';

/** Compatibility defaults; the composition root may supply a different context. */
export const defaultPersistence: PersistenceContext = Object.freeze({
	executor: db,
	unitOfWork: new DrizzleUnitOfWork(db),
});
