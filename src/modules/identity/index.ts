/**
 * Identity module public API (facade over legacy services).
 * Next: move StartService/ClassChangeService/ProfileService transaction bodies
 * into use-cases here; keep this barrel as the only import path for callers.
 */
export { StartService } from './application/StartService.js';
export { ClassChangeService } from './application/ClassChangeService.js';
export { ProfileService } from './application/ProfileService.js';
export { PlayerAccount } from './domain/PlayerAccount.js';
export type { CombatClass } from './domain/PlayerAccount.js';
export * from '../../db/tables/identity.js';
