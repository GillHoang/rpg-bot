/**
 * Quest balance — M7 design defaults (không port từ bản gốc).
 * Mỗi ngày/tuần người chơi nhận lazily 3 quest từ pool (không trùng loại);
 * progress chạy trong transaction của hành động, hoàn thành tự cộng thưởng.
 * Wording của từng quest nằm ở src/shared/ui/text/quest.ts (QUEST_*_LABELS).
 */
export type QuestType = 'raid_win' | 'duel_win' | 'ranked' | 'summon' | 'enhance' | 'open_chest' | 'casino' | 'daily';

export interface QuestTemplate {
	type: QuestType;
	target: number;
}

export const DAILY_POOL: readonly QuestTemplate[] = [
	{ type: 'raid_win', target: 5 },
	{ type: 'summon', target: 3 },
	{ type: 'enhance', target: 2 },
	{ type: 'open_chest', target: 3 },
	{ type: 'casino', target: 5 },
	{ type: 'daily', target: 1 },
];

export const WEEKLY_POOL: readonly QuestTemplate[] = [
	{ type: 'raid_win', target: 15 },
	{ type: 'summon', target: 10 },
	{ type: 'duel_win', target: 5 },
	{ type: 'ranked', target: 5 },
	{ type: 'open_chest', target: 10 },
	{ type: 'enhance', target: 6 },
];

/** Thưởng mỗi daily quest — roll ngẫu nhiên trong range lúc sinh quest. */
export const DAILY_REWARD = { credux: [20_000, 60_000], shards: [50, 150] } as const;
/** Thưởng mỗi weekly quest. */
export const WEEKLY_REWARD = { credux: [50_000, 150_000], valor: [5, 15] } as const;

/** Đủ 3 daily → +1 Sacred Relic (bảng daily_quest_completion_rewards). */
export const DAILY_ALL_COMPLETE_RELICS = 1;
/** Đủ 3 weekly → weekly grand claim qua /quest claim. */
export const WEEKLY_GRAND = { diamondChest: 1, credux: 100_000 };
export const QUESTS_PER_CYCLE = 3;
