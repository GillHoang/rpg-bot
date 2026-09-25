import { rollChance } from '../../../shared/utils/weightedRandom.js';
/**
 * Pure damage-formula constants + functions, ported 1:1 from
 * config/combat.js. No battle state here — safe to unit test in
 * isolation, same guarantee the original file documented for itself.
 */

/** A crit doubles the hit (before the additive damage-% rider). */
export const CRIT_MULT = 2.0;

/** §12 (P1 rebalance): mitigation = min(CAP, DEF/(DEF+K)). K=600: def 200
 * chặn 25%, def 400 chặn 40%, def 600 chặn 50% — giáp có ý nghĩa trở lại
 * mà không bóp chết sát thương như K cũ (200). Cap 75% giữ chip damage
 * luôn tồn tại khi ATK > 0 (không min-damage-1: test 0-ATK → draw giữ nguyên).
 */
const MITIGATION_K = 600;
const MITIGATION_CAP = 0.75;

/** Armor-penetration hiệu dụng: cộng dồn fraction rồi chặn 60%. */
export const PEN_CAP = 0.6;
export function effectivePierce(pierceFraction: number): number {
	return Math.min(PEN_CAP, Math.max(0, pierceFraction));
}

export const MAGE_OVERCHARGE_MULT = 4.0;
export const MAGE_OVERCHARGE_HIGH_MULT = 5.0;
export const MAGE_OVERCHARGE_HIGH_CHANCE = 0.4; // 40% chance of the 5.0x roll, else 4.0x
export const MAGE_OVERCHARGE_EVERY = 3; // fires on rounds 3, 6, 9, ...

/** Raw ATK after DEF mitigation, before variance/crit/damage-% riders.
 * Defensive: negative effective DEF is clamped to 0 (a shred can never turn
 * armor into a damage amplifier, and def = -600 can never divide by zero). */
export function mitigate(atk: number, def: number): number {
	if (atk <= 0) return 0;
	const safeDef = Math.max(0, def);
	return atk * (1 - Math.min(MITIGATION_CAP, safeDef / (safeDef + MITIGATION_K)));
}

/** Per-hit variance roll (default ±10%) so identical stats don't produce
 * identical damage every time. Skills with wilder swings pass their own
 * [min, max] range (Archer aimed shot hẹp, Mage Overcharge rộng). */
export function rollVariance(rng: () => number, range: readonly [number, number] = [0.9, 1.1]): number {
	const [min, max] = range;
	return min + rng() * (max - min);
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

/**
 * Hit roll (P2): base 95% adjusted by accuracy-vs-evasion points,
 * clamped to [80%, 100%]. ACC/EVA are flat points (Archer acc 8,
 * evasive mobs eva 10+) — small but tactically real.
 */
export function hitChance(attackerAcc: number, defenderEva: number): number {
	return Math.min(1, Math.max(0.8, 0.95 + 0.01 * (attackerAcc - defenderEva)));
}

export function rollHit(rng: () => number, attackerAcc: number, defenderEva: number): boolean {
	return rollChance(hitChance(attackerAcc, defenderEva), rng);
}
