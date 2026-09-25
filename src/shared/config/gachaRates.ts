import { pick } from '../utils/weightedRandom.js';
export type DeityTier = 'Epic' | 'Mythic' | 'Legendary' | 'Supreme';

/** Epic 64.5% · Mythic 34% · Legendary 1% · Supreme 0.5% — must sum to 1.0. */
export const TIER_WEIGHTS: ReadonlyArray<[DeityTier, number]> = [
	['Epic', 0.645],
	['Mythic', 0.34],
	['Legendary', 0.01],
	['Supreme', 0.005],
];

/** pity_count increments per natural roll; at 150 a Legendary is forced.
 * Calibrated 2026-09: at the natural 1.5% Legendary+ rate a 150-pull drought
 * happens ~10% of the time (0.985^150), so the safety net actually binds —
 * the old 500 (≈0.05% droughts) was decorative. Extra Legendary supply from
 * forcing is negligible (~1 forced per ~1500 pulls). */
export const PITY_THRESHOLD = 150;

export const SHARDS_PER_PULL = 100;
export const MAX_PULLS = 30;

/** Relic-forced tier pulls (/summon relic:…): không đụng pity, không tốn shards. */
export const RELIC_TIER_WEIGHTS: Record<'sacred' | 'supreme', ReadonlyArray<[DeityTier, number]>> = {
	sacred: [
		['Mythic', 0.7],
		['Legendary', 0.28],
		['Supreme', 0.02],
	],
	supreme: [
		['Legendary', 0.7],
		['Supreme', 0.3],
	],
};
export const RELIC_FIELD = { sacred: 'sacredRelics', supreme: 'supremeRelics' } as const;
export type RelicKind = keyof typeof RELIC_TIER_WEIGHTS;

export const ESSENCE_PER_DUPLICATE: Record<DeityTier, number> = {
	Epic: 1,
	Mythic: 2,
	Legendary: 5,
	Supreme: 10,
};

/** users_bag column (camelCase, matching schema.ts) that banks a tier's duplicate essence. */
export const TIER_ESSENCE_FIELD: Record<
	DeityTier,
	'epicEssence' | 'mythicEssence' | 'legendaryEssence' | 'supremeEssence'
> = {
	Epic: 'epicEssence',
	Mythic: 'mythicEssence',
	Legendary: 'legendaryEssence',
	Supreme: 'supremeEssence',
};

/**
 * Display-only alias for each tier; actual strings live in text/summon.ts
 * (TIER_ALIAS) so wording stays editable in one place.
 */

export interface RollOutcome {
	tier: DeityTier;
	newPity: number;
	pityReset: boolean;
}

/**
 * Resolve one natural roll against the running pity counter — ported 1:1
 * from config/gachaRates.js's resolveRoll.
 *  1. Natural weighted roll.
 *  2. Natural Legendary/Supreme -> keep it, pity resets to 0.
 *  3. Else (Epic/Mythic) -> pity += 1; at PITY_THRESHOLD, force Legendary and reset.
 */
export function resolveRoll(pity: number, rng: () => number): RollOutcome {
	const natural = rollTier(rng);
	if (natural === 'Legendary' || natural === 'Supreme') {
		return { tier: natural, newPity: 0, pityReset: true };
	}
	const incremented = pity + 1;
	if (incremented >= PITY_THRESHOLD) {
		return { tier: 'Legendary', newPity: 0, pityReset: true };
	}
	return { tier: natural, newPity: incremented, pityReset: false };
}

function rollTier(rng: () => number): DeityTier {
	return pick(
		TIER_WEIGHTS.map(([original, weight]) => ({ original, weight })),
		{ next: rng },
	);
}
