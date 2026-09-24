import { randomInt } from 'node:crypto';

/**
 * Canonical RNG entry point for new modules.
 * All gameplay randomness must flow through here — never Math.random().
 * Self-contained (mulberry32 + crypto seed) so `shared/kernel` never
 * depends on `modules/*` — dependency direction stays kernel <- modules.
 */
export interface RngProvider {
	next(): number;
}

export function createSecureSeed(): number {
	return randomInt(0, 0x7fffffff);
}

export function createRng(seed: number): RngProvider {
	let state = seed >>> 0;
	const next = (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return { next };
}

export function createSecureRng(): RngProvider {
	return createRng(createSecureSeed());
}
