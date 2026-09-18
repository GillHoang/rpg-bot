export type DeityTier = 'Epic' | 'Mythic' | 'Legendary' | 'Supreme';

/** Epic 64.5% · Mythic 34% · Legendary 1% · Supreme 0.5% — must sum to 1.0. */
export const TIER_WEIGHTS: ReadonlyArray<[DeityTier, number]> = [
	['Epic', 0.645],
	['Mythic', 0.34],
	['Legendary', 0.01],
	['Supreme', 0.005],
];

/** pity_count increments per natural roll; at 500 a Legendary is forced. */
export const PITY_THRESHOLD = 500;

export const SHARDS_PER_PULL = 100;
export const MAX_PULLS = 30;

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

export const TIER_ALIAS: Record<DeityTier, string> = {
	Epic: 'Remnant',
	Mythic: 'Awakened',
	Legendary: 'Undying',
	Supreme: 'Primordial',
};

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
 *  3. Else (Epic/Mythic) -> pity += 1; at 500, force Legendary and reset.
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
	const roll = rng();
	let cumulative = 0;
	for (const [tier, weight] of TIER_WEIGHTS) {
		cumulative += weight;
		if (roll < cumulative) return tier;
	}
	return TIER_WEIGHTS[TIER_WEIGHTS.length - 1]![0];
}
