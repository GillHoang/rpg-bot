import { weekWindowAt } from './ranked.js';

/**
 * Phase 4 weekly modifier (battle-upgrade-plan.md §4d): one global hunt
 * modifier rotating on the ISO week — regular/elite hunts only (never boss,
 * final boss, duel or ranked). Deterministic per week, no cron needed.
 */
export type WeeklyModifier = 'none' | 'bloodmoon' | 'frenzy' | 'drought';

/** Rotation order — one entry per ISO-week index. */
const ROTATION: readonly WeeklyModifier[] = ['none', 'bloodmoon', 'frenzy', 'drought'];

/** Phase 4 weekly tuning (config boundary — balance lives here, not in code). */
export const WEEKLY_FRENZY_DAMAGE_PCT = 0.2;
export const WEEKLY_DROUGHT_HEAL_MULT = 0.5;

/** Deterministic weekly modifier for a date (ISO week number drives the cycle). */
export function weeklyModifierAt(date: Date): WeeklyModifier {
	const { week } = weekWindowAt(date);
	return ROTATION[week % ROTATION.length]!;
}

/** Weekly applies to regular/elite hunts only — never boss, final, duel or ranked. */
export function isWeeklyEligible(boss: boolean, finalBoss: boolean): boolean {
	return !boss && !finalBoss;
}

interface WeeklyFlagCarrier {
	fieldDamagePct: number;
	earlySuddenDeath: boolean;
	healMult: number;
}

/** Applies a weekly modifier to both sides' battle flags (no-op for 'none'). */
export function applyWeeklyFlags(
	player: WeeklyFlagCarrier,
	enemy: WeeklyFlagCarrier,
	modifier: WeeklyModifier,
): void {
	if (modifier === 'frenzy') {
		player.fieldDamagePct += WEEKLY_FRENZY_DAMAGE_PCT;
		enemy.fieldDamagePct += WEEKLY_FRENZY_DAMAGE_PCT;
	} else if (modifier === 'drought') {
		player.healMult = WEEKLY_DROUGHT_HEAL_MULT;
		enemy.healMult = WEEKLY_DROUGHT_HEAL_MULT;
	} else if (modifier === 'bloodmoon') {
		player.earlySuddenDeath = true;
		enemy.earlySuddenDeath = true;
	}
}
