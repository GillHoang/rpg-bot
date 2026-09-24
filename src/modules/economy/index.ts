/**
 * Economy module public API (pilot slice).
 * Presentation imports from here — never from services/ or repositories/ directly.
 */
export { ECONOMY_CONFIG } from './config.js';
export * from './domain/index.js';
export * from './application/index.js';
export * from '../../db/tables/economy.js';
