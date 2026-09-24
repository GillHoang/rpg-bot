/** Injectable wall-clock so time-dependent rules (daily cycle, cooldowns) are testable. */
export interface Clock {
	now(): Date;
}

export const systemClock: Clock = {
	now: () => new Date(),
};

/** Deterministic clock for tests — always returns a copy of `fixed`. */
export function fixedClock(fixed: Date): Clock {
	const at = fixed.getTime();
	return { now: () => new Date(at) };
}
