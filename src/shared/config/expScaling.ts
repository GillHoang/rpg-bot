/**
 * Mob-level EXP scaling — ported 1:1 from config/expScaling.js.
 * multiplier = max(FLOOR, (clamp(level) / PIVOT) ** EXPONENT), so a raid
 * win against a higher-level mob is worth proportionally more EXP.
 */
const MOB_LEVEL_MIN = 1;
const MOB_LEVEL_MAX = 120;
const SCALING_PIVOT_LEVEL = 30;
const SCALING_EXPONENT = 2;
const SCALING_FLOOR = 1.0;

export function scaleExpForMobLevel(baseExp: number, levelForScaling: number): number {
	const base = Math.max(0, baseExp || 0);
	const level = Math.max(MOB_LEVEL_MIN, Math.min(MOB_LEVEL_MAX, Math.floor(levelForScaling || MOB_LEVEL_MIN)));
	const multiplier = Math.max(SCALING_FLOOR, (level / SCALING_PIVOT_LEVEL) ** SCALING_EXPONENT);
	return Math.round(base * multiplier);
}
