import type { ClaimDailyResult } from '../services/DailyService.js';
import { DAILY_MILESTONE_LINE, DAILY_SUCCESS } from '../text/daily.js';
import { formatNumber } from '../text/format.js';

/** Shared presentation for slash-command and menu daily rewards. */
export function dailyRewardText(result: Extract<ClaimDailyResult, { status: 'ok' }>): string {
	return DAILY_SUCCESS(
		result.day,
		result.monthly,
		result.overall,
		formatNumber(result.credux, 'vi-VN'),
		result.shards,
		result.chestLabel,
		result.milestoneChestLabel ? DAILY_MILESTONE_LINE(result.milestoneChestLabel) : '',
	);
}
