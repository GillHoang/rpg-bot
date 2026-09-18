import { randomInt } from 'node:crypto';

/**
 * High-entropy seed for gameplay rolls that must NOT be predictable
 * (casino outcomes, gacha, loot) — a wall-clock millisecond XORed with
 * public inputs lets players replay/predict results. Battles that want
 * deterministic replays should keep passing an explicit seed instead.
 */
export function createSecureSeed(): number {
	return randomInt(0, 0x7fffffff);
}

/**
 * Small seeded PRNG (mulberry32). Ported in spirit, not verbatim, from
 * battleEngine.js's `rngOf` — good enough for gameplay determinism
 * (same seed -> same battle) without needing the original's exact
 * bit-for-bit stream, which existed for a replay feature not yet ported.
 */
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
