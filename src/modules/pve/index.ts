/**
 * PvE module public API (facade over legacy raid services).
 * Next: extract RaidService.run phases (attempt-gate, battle, rewards, streak)
 * into use-cases here; CombatSetup already injected via `combat` option.
 */
export { RaidService } from './application/RaidService.js';
export type { RaidResult, RaidRunOptions } from './application/RaidService.js';
export { RaidRewardService } from './application/RaidRewardService.js';
export { MonsterEncounterService } from './application/MonsterEncounterService.js';
export * from '../../db/tables/pve.js';
