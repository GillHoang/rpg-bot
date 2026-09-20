import { CURRENCY } from './common.js';
import { ICONS } from './icons.js';

export const DAILY_DESCRIPTION = 'Nhận phần thưởng điểm danh hàng ngày';

export const DAILY_ALREADY_CLAIMED = (day: number): string =>
	`${ICONS.daily.already} Bạn đã điểm danh hôm nay rồi (Ngày ${day}). Quay lại sau nửa đêm giờ Manila.`;

export const DAILY_MILESTONE_LINE = (chestLabel: string): string => `\n${ICONS.reward.chest} Cột mốc: +1 ${chestLabel}`;

export const DAILY_SUCCESS = (
	day: number,
	monthly: number,
	streak: number,
	credux: string,
	shards: number,
	chestLabel: string,
	milestoneLine: string,
): string =>
	`${ICONS.daily.header} **Điểm Danh Hằng Ngày — Ngày ${day}**\n` +
	`Tháng: ${monthly}/30 · Chuỗi ngày: ${streak}\n\n` +
	`${ICONS.economy.wallet} +${credux} ${CURRENCY.credux}\n` +
	`${ICONS.economy.shards} +${shards} ${CURRENCY.beliefShards}\n` +
	`${ICONS.reward.chest} +1 ${chestLabel}${milestoneLine}`;

/** Nhãn rương hiển thị cho DailyRewardTable (khớp key cột chest trong DB). */
export const CHEST_LABELS = {
	silver_chest: 'Silver Chest',
	gold_chest: 'Gold Chest',
	boss_treasure_chest: 'Boss Treasure Chest',
	boss_golden_chest: 'Boss Golden Chest',
} as const;
