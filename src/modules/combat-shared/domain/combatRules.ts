/** Rounds 1–30 are normal; 31–40 blood-moon soft enrage (P6 rebalance):
 * damage creeps +10%/round (cap ×2.0 at round 40) and both sides bleed
 * 2% max HP per round — anti-stall pressure without the old ×1024 hammer. */
export const SUDDEN_DEATH_START = 30;
export const MAX_ROUNDS = 40;

/** Phase 4 weekly bloodmoon moves the enrage window to rounds 16–25. */
export const EARLY_SUDDEN_DEATH_START = 15;

/** Soft-enrage amplifier (round ≤ 30 → ×1; 31 → ×1.1 … 40 → ×2.0). */
export function suddenDeathMultiplier(round: number, start: number = SUDDEN_DEATH_START): number {
	if (round <= start) return 1;
	return 1 + 0.1 * (round - start);
}

/** Blood-moon price both sides pay each enrage round (fraction of max HP). */
export const BLOOD_MOON_PCT = 0.02;
