/**
 * Casino payout tables — SINGLE SOURCE OF TRUTH for every multiplier/limit,
 * ported 1:1 from casino/payoutTables.js. Virtual economy: every win pays
 * 100% of the stated multiplier (no house edge); `payout` is always the
 * GROSS amount returned to the player (stake included).
 */
export const MAX_BET = 500_000;
export const EVEN_MONEY = 2;
/**
 * Baccarat banker wins pay 1.95x gross (standard 5% commission). Without it
 * the banker side is +EV (~+1.24%: banker wins ~46% vs player ~44.75% on a
 * single deck) and becomes an unbounded slow money printer at MAX_BET.
 * Player wins keep EVEN_MONEY.
 */
export const BANKER_PAYOUT_MULT = 1.95;

export type SlotFace = 'horus' | 'lightning' | 'skull' | 'trident' | 'wings';

/**
 * Highest-prize-first ladder resolved as ONE mutually-exclusive roll
 * (cumulative thresholds; blank fills the rest). Probabilities are tuned
 * so Σ prob·mult = 1.0 exactly — the stated 100% RTP. Treating each rung
 * as an independent roll would compound them into a ~194% money printer.
 */
export const SLOT_LADDER: ReadonlyArray<{ face: SlotFace; prob: number; mult: number }> = [
	{ face: 'wings', prob: 0.4, mult: 20 },
	{ face: 'trident', prob: 1.6, mult: 10 },
	{ face: 'skull', prob: 4, mult: 5 },
	{ face: 'lightning', prob: 13, mult: 2 },
	{ face: 'horus', prob: 20, mult: 1.5 },
];

const CRASH_CHANCE_FIRST = 15;
const CRASH_CHANCE_STEP = 2;
const CRASH_CHANCE_MAX = 75;
export const CRASH_MAX_PUSHES = 10;

/** Crash chance (%) rolled when ATTEMPTING the given push number. */
export function crashChance(push: number): number {
	return Math.min(CRASH_CHANCE_MAX, CRASH_CHANCE_FIRST + CRASH_CHANCE_STEP * Math.max(0, push - 1));
}

/**
 * Cash-out multiplier locked in by SURVIVING the given push number.
 * Fair by construction: 1 / (product of survival odds through that push),
 * ROUNDED DOWN to 2 decimals so cashing out at ANY push has EV <= 1.0x the
 * bet (the house never subsidizes a cash-out timing strategy).
 */
export function crashMultiplier(push: number): number {
	let multiplier = 1;
	for (let n = 1; n <= push; n++) multiplier /= 1 - crashChance(n) / 100;
	return Math.floor(multiplier * 100) / 100;
}
