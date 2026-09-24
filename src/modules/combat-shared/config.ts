import { MAX_ROUNDS, SUDDEN_DEATH_START } from './domain/combatRules.js';

/**
 * Combat-shared tuning lives with the module. Values mirror combatRules.ts;
 * future balance edits happen here and flow down.
 */
export const COMBAT_SHARED_CONFIG = {
	maxRounds: MAX_ROUNDS,
	suddenDeathStart: SUDDEN_DEATH_START,
} as const;
