export type ChestColumn = 'silver_chest' | 'gold_chest' | 'boss_treasure_chest' | 'boss_golden_chest';

import { CHEST_LABELS } from '../../text/daily.js';

export interface DailyReward {
	credux: number;
	shards: number;
	chestColumn: ChestColumn;
	chestLabel: string;
}

export interface StreakMilestone {
	chestColumn: ChestColumn;
	chestLabel: string;
}

const GOLD_DAYS = new Set([7, 14, 21, 28, 29, 30]);

/**
 * Pure reward-table lookups, ported 1:1 from commands/economy/daily.js.
 * Kept side-effect-free and DB-free so the numbers can be unit tested
 * without spinning up a database.
 */
export class DailyRewardTable {
	/** Reward by monthly cycle day position (1-30). */
	static rewardForDay(day: number): DailyReward {
		const gold = GOLD_DAYS.has(day);
		let credux: number;
		let shards: number;

		if (day === 30) [credux, shards] = [1_500_000, 1000];
		else if (day === 29) [credux, shards] = [1_000_000, 750];
		else if (day === 28) [credux, shards] = [750_000, 600];
		else if (day >= 22) [credux, shards] = [150_000, 250];
		else if (day === 21) [credux, shards] = [600_000, 500];
		else if (day >= 15) [credux, shards] = [100_000, 200];
		else if (day === 14) [credux, shards] = [400_000, 350];
		else if (day >= 8) [credux, shards] = [75_000, 150];
		else if (day === 7) [credux, shards] = [250_000, 250];
		else [credux, shards] = [50_000, 100];

		return {
			credux,
			shards,
			chestColumn: gold ? 'gold_chest' : 'silver_chest',
			chestLabel: gold ? CHEST_LABELS.gold_chest : CHEST_LABELS.silver_chest,
		};
	}

	/** Bonus chest earned by the newly reached consecutive streak, if any. */
	static milestoneForStreak(streak: number): StreakMilestone | null {
		if (streak === 15) {
			return { chestColumn: 'boss_treasure_chest', chestLabel: CHEST_LABELS.boss_treasure_chest };
		}
		if (streak >= 30 && streak % 15 === 0) {
			return { chestColumn: 'boss_golden_chest', chestLabel: CHEST_LABELS.boss_golden_chest };
		}
		return null;
	}
}
