import { db } from './client.js';
import type { PersistenceContext } from '../shared/kernel/persistence.js';
import { DrizzleUnitOfWork } from './DrizzleUnitOfWork.js';

/** Compatibility defaults; the composition root may supply a different context. */
export const defaultPersistence: PersistenceContext = Object.freeze({
	executor: db,
	unitOfWork: new DrizzleUnitOfWork(db),
});
