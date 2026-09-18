import { rollChance } from '../../utils/weightedRandom.js';
/**
 * Pure damage-formula constants + functions, ported 1:1 from
 * config/combat.js. No battle state here — safe to unit test in
 * isolation, same guarantee the original file documented for itself.
 */

/** A crit doubles the hit (before the additive damage-% rider). */
export const CRIT_MULT = 2.0;

/** §12: mitigation = 1 - DEF/(DEF+K); K=200 means DEF and ATK trade off gently. */
const MITIGATION_K = 200;

export const MAGE_OVERCHARGE_MULT = 4.0;
export const MAGE_OVERCHARGE_HIGH_MULT = 5.0;
export const MAGE_OVERCHARGE_HIGH_CHANCE = 0.4; // 40% chance of the 5.0x roll, else 4.0x
export const MAGE_OVERCHARGE_EVERY = 3; // fires on rounds 3, 6, 9, ...

/** Raw ATK after DEF mitigation, before variance/crit/damage-% riders. */
export function mitigate(atk: number, def: number): number {
	return atk * (1 - def / (def + MITIGATION_K));
}

/** Per-hit ±10% roll so identical stats don't produce identical damage every time. */
export function rollVariance(rng: () => number): number {
	return 0.9 + rng() * 0.2;
}

/**
 * Final per-hit damage multiplier under the unified rule: every damage
 * bonus (class passive, future weapon/deity bonuses) is a plain
 * "damage %" that stacks additively and applies to BOTH crit and
 * non-crit hits.
 */
export function hitMultiplier(crit: boolean, damagePct: number): number {
	return (crit ? CRIT_MULT : 1) + damagePct / 100;
}

/** `critChance` is a percentage (e.g. 5 means 5%), matching how it's stored throughout the schema. */
export function rollCrit(rng: () => number, critChance: number): boolean {
	return rollChance(critChance / 100, rng);
}
