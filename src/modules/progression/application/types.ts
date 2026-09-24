import type { DeityTier, RelicKind } from '../../../shared/config/gachaRates.js';

/** Canonical summon result — owned by the progression module. */
export interface SummonPullResult {
	tier: DeityTier;
	name: string;
	mythology: string;
	blessingName: string;
	isDupe: boolean;
	essenceGained: number;
}

export type SummonResult =
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'invalid-count' }
	| { status: 'insufficient-shards'; needed: number; have: number }
	| { status: 'insufficient-relics'; relic: RelicKind; needed: number; have: number }
	| { status: 'no-deities-seeded'; tier: DeityTier }
	| { status: 'ok'; pulls: SummonPullResult[]; finalPity: number; shardsSpent: number };
