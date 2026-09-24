/** Injectable wall-clock so time-dependent rules (daily cycle, cooldowns) are testable. */
export interface Clock {
	now(): Date;
}

export const systemClock: Clock = {
	now: () => new Date(),
};
