/**
 * Quest balance — M7 design defaults (không port từ bản gốc).
 * Mỗi ngày/week người chơi nhận lazily 3 quest từ pool (không trùng loại);
 * progress chạy qua EventBus subscriber, hoàn thành tự cộng thưởng.
 */
export type QuestType = 'raid_win' | 'duel_win' | 'ranked' | 'summon' | 'enhance' | 'open_chest' | 'casino' | 'daily';

export interface QuestTemplate {
	type: QuestType;
	target: number;
	label: string;
}

export const DAILY_POOL: readonly QuestTemplate[] = [
	{ type: 'raid_win', target: 5, label: 'Thắng 5 lượt /raid hunt' },
	{ type: 'summon', target: 3, label: 'Summon 3 lượt (bất kỳ)' },
	{ type: 'enhance', target: 2, label: 'Nâng gear 2 lần' },
	{ type: 'open_chest', target: 3, label: 'Mở 3 rương' },
	{ type: 'casino', target: 5, label: 'Chơi casino 5 ván' },
	{ type: 'daily', target: 1, label: 'Claim /daily' },
];

export const WEEKLY_POOL: readonly QuestTemplate[] = [
	{ type: 'raid_win', target: 15, label: 'Thắng 15 lượt raid/boss' },
	{ type: 'summon', target: 10, label: 'Summon 10 lượt' },
	{ type: 'duel_win', target: 5, label: 'Thắng 5 duel' },
	{ type: 'ranked', target: 5, label: 'Đủ 5 trận ranked' },
	{ type: 'open_chest', target: 10, label: 'Mở 10 rương' },
	{ type: 'enhance', target: 6, label: 'Nâng gear 6 lần' },
];

/** Thưởng mỗi daily quest — roll ngẫu nhiên trong range lúc sinh quest. */
export const DAILY_REWARD = { credux: [20_000, 60_000], shards: [50, 150] } as const;
/** Thưởng mỗi weekly quest. */
export const WEEKLY_REWARD = { credux: [50_000, 150_000], valor: [5, 15] } as const;

/** Đủ 3 daily → +1 Sacred Relic (bảng daily_quest_completion_rewards). */
export const DAILY_ALL_COMPLETE_RELICS = 1;
/** Đủ 3 weekly → weekly grand claim qua /quest claim. */
export const WEEKLY_GRAND = { diamondChest: 1, credux: 100_000 };

/** /quest refresh: reroll daily 1 lần/ngày. */
export const DAILY_REFRESH_LIMIT = 1;
export const QUESTS_PER_CYCLE = 3;
