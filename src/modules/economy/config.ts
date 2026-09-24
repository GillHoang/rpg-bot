/**
 * Economy balance numbers live with the module, not in a global config dir.
 * Values mirror DailyRewardTable + schema defaults; new tuning edits here.
 */
export const ECONOMY_CONFIG = {
	// NOTE: the daily-reset timezone lives in one place only —
	// DailyCycle (shared/utils/dailyCycle.ts). Do not re-add a copy here.
	monthlyCycleLength: 30,
} as const;
