/**
 * Believer EXP / Reputation balance — M7 design defaults (không port từ bản
 * gốc, Master §18 không có trong repo). EXP cộng vào user_character
 * (believer_exp/believer_level) với cap hằng ngày theo lịch Asia/Ho_Chi_Minh
 * (reputation_exp_today + reputation_exp_reset_date). Believer level là gate
 * tier cosmetic (config/pvpShop + cosmeticCatalog.tier).
 */
export const BELIEVER_EXP_SOURCES = {
	daily: 50,
	raid_win: 30,
	duel_win: 40,
	ranked_win: 50,
	quest_complete: 25,
	weekly_grand: 100,
} as const;

export type BelieverExpSource = keyof typeof BELIEVER_EXP_SOURCES;

export const BELIEVER_DAILY_CAP = 500;

/** Level N → N+1 tốn 400 + 100×N EXP (level bắt đầu từ 1). */
export function believerLevelCost(currentLevel: number): number {
	return 400 + 100 * currentLevel;
}

/** Believer level tối thiểu để sở hữu cosmetic theo tier. */
export const COSMETIC_TIER_MIN_LEVEL = {
	believer: 1,
	chosen: 5,
	eternal: 10,
} as const;
