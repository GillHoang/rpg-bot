import type { DeityTier } from './gachaRates.js';

export const MAX_SIGILS = 10;
const BASE_STAT_FRACTION = 0.5; // unlock at 50% of base stats
const PER_SIGIL_FRACTION = 0.05; // +5% of base stats per Sigil

/** Sigil essence cost — [tier][sigil number 1..10]. Column totals: Epic 100 · Mythic 83 · Legendary 47 · Supreme 30. */
const SIGIL_ESSENCE_COST: Record<DeityTier, Record<number, number>> = {
	Epic: { 1: 5, 2: 5, 3: 5, 4: 10, 5: 10, 6: 10, 7: 10, 8: 15, 9: 15, 10: 15 },
	Mythic: { 1: 5, 2: 5, 3: 5, 4: 8, 5: 8, 6: 8, 7: 8, 8: 12, 9: 12, 10: 12 },
	Legendary: { 1: 3, 2: 3, 3: 3, 4: 5, 5: 5, 6: 5, 7: 5, 8: 6, 9: 6, 10: 6 },
	Supreme: { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 4, 9: 4, 10: 4 },
};

const ASCENSION_COST: Record<DeityTier, { essence: number; credux: number }> = {
	Epic: { essence: 50, credux: 100_000 },
	Mythic: { essence: 40, credux: 250_000 },
	Legendary: { essence: 20, credux: 500_000 },
	Supreme: { essence: 15, credux: 1_000_000 },
};

/** Sigil-scaled stat multiplier for a sigil count (clamped 0..10). */
export function sigilMultiplier(sigils: number): number {
	const n = Math.max(0, Math.min(MAX_SIGILS, sigils || 0));
	return BASE_STAT_FRACTION + PER_SIGIL_FRACTION * n;
}

/** Effective deity stats AT READ TIME: base * (0.50 + 0.05 * sigils), floored. */
export function computeSigilStats(
	base: { atk: number; hp: number; def: number },
	sigils: number,
): { atk: number; hp: number; def: number } {
	const m = sigilMultiplier(sigils);
	return { atk: Math.floor(base.atk * m), hp: Math.floor(base.hp * m), def: Math.floor(base.def * m) };
}

/** Cost of the NEXT Sigil (null at 10/10 — next step is Ascension, not a Sigil). */
export function nextSigilCost(tier: DeityTier, sigils: number): { sigil: number; essence: number } | null {
	const n = sigils || 0;
	if (n >= MAX_SIGILS) return null;
	const costs = SIGIL_ESSENCE_COST[tier];
	const essence = costs?.[n + 1];
	return essence == null ? null : { sigil: n + 1, essence };
}

export function ascensionCost(tier: DeityTier): { essence: number; credux: number } | null {
	return ASCENSION_COST[tier] ?? null;
}
