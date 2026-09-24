/**
 * PvP module public API (facade over legacy duel/ranked/shop services).
 * Next: extract accept/fight/claim settlements into use-cases here.
 */
export { DuelService, DUEL_STAKE_MIN, DUEL_EXPIRES_SECONDS } from './application/DuelService.js';
export type { DuelCreateResult, DuelAcceptResult } from './application/DuelService.js';
export { RankedService } from './application/RankedService.js';
export type { RankedFightResult, RankedClaimResult } from './application/RankedService.js';
export { PvpShopService } from './application/PvpShopService.js';
export * from '../../db/tables/pvp.js';
