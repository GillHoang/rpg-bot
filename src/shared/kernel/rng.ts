import {
	createRng as baseCreateRng,
	createSecureSeed as baseCreateSecureSeed,
} from '../../modules/combat-shared/domain/Rng.js';

/**
 * Canonical RNG entry point for new modules.
 * All gameplay randomness must flow through here — never Math.random().
 */
export interface RngProvider {
	next(): number;
}

export function createRng(seed: number): RngProvider {
	const next = baseCreateRng(seed);
	return { next };
}

export function createSecureSeed(): number {
	return baseCreateSecureSeed();
}

export function createSecureRng(): RngProvider {
	return createRng(baseCreateSecureSeed());
}
