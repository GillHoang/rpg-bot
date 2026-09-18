/**
 * Combat Level EXP curve — ported 1:1 from config/combatExp.js.
 * lifetime_exp is the source of truth; combat_level/combat_exp are a
 * derived cache kept in sync by applyCombatExp.
 */
export const MAX_COMBAT_LEVEL = 100;

const EXP_TO_NEXT: number[] = [
	100, 250, 500, 1000, 1800, 3000, 5000, 8000, 12000, 20000, 30000, 45000, 65000, 95000, 140000, 200000, 290000,
	420000, 600000, 700000, 745000, 790000, 840000, 895000, 950000, 1010000, 1075000, 1145000, 1215000, 1300000,
	2100000, 3300000, 4600000, 6000000, 7500000, 9100000, 10800000, 12600000, 14500000, 16500000, 18600000, 20800000,
	23100000, 25500000, 28000000, 30600000, 33300000, 36100000, 39000000, 42000000,
];

const TAIL_BASE = 42_000_000;
const TAIL_GAP = 1_000_000;
for (let level = 51; level <= MAX_COMBAT_LEVEL - 1; level += 1) {
	EXP_TO_NEXT.push(TAIL_BASE + TAIL_GAP * (level - 51));
}

/** EXP_REQUIRED[level] = cost of level -> level+1, keyed 1..MAX_COMBAT_LEVEL-1. */
const EXP_REQUIRED: Record<number, number> = EXP_TO_NEXT.reduce<Record<number, number>>((acc, cost, i) => {
	acc[i + 1] = cost;
	return acc;
}, {});

/** EXP needed to go from `level` to `level + 1` (0 at the level cap). */
export function expRequiredForLevel(level: number): number {
	return EXP_REQUIRED[level] ?? 0;
}

export interface CombatExpProgress {
	level: number;
	exp: number;
	leveledUp: boolean;
}

/** Apply a combat-EXP gain to (level, within-level exp). Supports multi-level jumps. */
export function applyCombatExp(level: number, exp: number, gain: number): CombatExpProgress {
	let lv = Math.max(1, Math.min(MAX_COMBAT_LEVEL, level || 1));
	let xp = (exp || 0) + Math.max(0, gain || 0);
	const startLevel = lv;
	while (lv < MAX_COMBAT_LEVEL && xp >= EXP_REQUIRED[lv]!) {
		xp -= EXP_REQUIRED[lv]!;
		lv += 1;
	}
	return { level: lv, exp: xp, leveledUp: lv > startLevel };
}
