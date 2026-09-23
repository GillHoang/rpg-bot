/** Text hệ quest (service + lệnh /quest) — sửa wording ngay tại đây. */
import type { QuestType } from '../config/quests.js';
import { ICONS } from './icons.js';

// --- Lệnh ---
export const QUEST_DESCRIPTION = 'Quest hằng ngày và hằng tuần';
export const QUEST_VIEW_DESC = 'Xem quest hiện tại và tiến độ';
export const QUEST_REFRESH_DESC = 'Reroll daily quests (1 lần/ngày)';
export const QUEST_CLAIM_DESC = 'Claim Weekly Grand khi đủ 3 weekly quest';

// --- Nhãn quest (cặp số target nằm ở config/quests.ts, wording nằm ở đây) ---
export const DAILY_QUEST_LABELS: Record<QuestType, string> = {
	raid_win: 'Thắng 5 lượt /raid hunt',
	summon: 'Summon 3 lượt (bất kỳ)',
	enhance: 'Nâng gear 2 lần',
	open_chest: 'Mở 3 rương',
	casino: 'Chơi casino 5 ván',
	daily: 'Claim /daily',
	duel_win: 'Thắng 5 duel',
	ranked: 'Đủ 5 trận ranked',
};
export const WEEKLY_QUEST_LABELS: Record<QuestType, string> = {
	raid_win: 'Thắng 15 lượt raid/boss',
	summon: 'Summon 10 lượt',
	enhance: 'Nâng gear 6 lần',
	open_chest: 'Mở 10 rương',
	casino: 'Chơi casino 20 ván',
	daily: 'Claim /daily 7 ngày',
	duel_win: 'Thắng 5 duel',
	ranked: 'Đủ 5 trận ranked',
};

// --- view ---
export const QUEST_REGISTER_FIRST = 'Gõ /start để đăng ký trước.';
export const QUEST_DAILY_HEADER = (day: string): string => `${ICONS.quest.dailyHeader} **Daily quests (${day})**`;
export const QUEST_DAILY_ALL_DONE = (relics: number): string =>
	`\n${ICONS.status.completed} Đủ 3 daily — đã nhận +${relics} Sacred Relic.`;
export const QUEST_WEEKLY_HEADER = (week: string): string =>
	`\n\n${ICONS.quest.weeklyHeader} **Weekly quests (tuần ${week})**`;
export const QUEST_GRAND_READY = '\n' + ICONS.quest.grand + ' Đủ 3 weekly — dùng `/quest claim` nhận Weekly Grand!';
export const QUEST_GRAND_CLAIMED = '\n' + ICONS.status.completed + ' Weekly grand đã claim tuần này.';

// --- format một dòng quest ---
export const QUEST_BONUS_SHARDS = (bonus: number): string => `${bonus} shards`;
export const QUEST_BONUS_VALOR = (bonus: number): string => `${bonus} valor`;
export const QUEST_CREDUX_PART = (creux: string): string => `(+${creux} Credux, `;

// --- refresh ---
export const QUEST_REFRESH_LIMIT = 'Đã refresh daily hôm nay. Reset lúc 00:00 Asia/Manila.';
export const QUEST_REFRESH_DONE = 'Đã đổi các nhiệm vụ ngày chưa hoàn thành.';

// --- claim weekly grand ---
export const QUEST_CLAIM_NOT_READY = 'Chưa đủ 3 weekly quest.';
export const QUEST_CLAIM_ALREADY = 'Weekly grand tuần này đã nhận rồi.';
export const QUEST_CLAIM_OK = (creux: string, diamonds: number): string =>
	`${ICONS.quest.grand} Weekly Grand! +${creux} Credux · +${diamonds} Diamond Chest.`;
