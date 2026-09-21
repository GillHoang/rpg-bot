/** Rounds 1–30 are normal; 31–40 sudden death: all damage × 2^(round−30). */
export const SUDDEN_DEATH_START = 30;
export const MAX_ROUNDS = 40;

/** Damage amplifier once sudden death kicks in (round ≤ 30 → ×1). */
export function suddenDeathMultiplier(round: number): number {
	if (round <= SUDDEN_DEATH_START) return 1;
	return 2 ** (round - SUDDEN_DEATH_START);
}
