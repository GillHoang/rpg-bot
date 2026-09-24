/**
 * Economy balance numbers live with the module, not in a global config dir.
 * Values mirror DailyRewardTable + schema defaults; new tuning edits here.
 */
export const ECONOMY_CONFIG = {
	dailyCycleTimeZone: 'Asia/Ho_Chi_Minh',
	monthlyCycleLength: 30,
} as const;
