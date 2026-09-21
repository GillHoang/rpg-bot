import { db } from '../db/client.js';
import { DailyRepository } from '../repositories/DailyRepository.js';
import { DailyRewardTable } from '../domain/economy/DailyRewardTable.js';
import { DailyCycle } from '../utils/dailyCycle.js';
import { EventBus } from '../core/EventBus.js';
import { applyGameplayProgress } from './gameplayProgress.js';

export type ClaimDailyResult =
	| { status: 'not-registered' }
	| { status: 'already-claimed'; overall: number }
	| {
			status: 'ok';
			day: number;
			monthly: number;
			overall: number;
			credux: number;
			shards: number;
			chestLabel: string;
			milestoneChestLabel: string | null;
	  };

/**
 * Facade over the daily-attendance claim transaction, ported from
 * commands/economy/daily.js's claimDaily. Two counters: monthlyStreak
 * (rolling 1-30 reward cycle) and overallStreak (consecutive-day streak,
 * used for milestone chests and the player-facing "Day N" label).
 */
export class DailyService {
	constructor(
		private readonly repo = new DailyRepository(),
		private readonly events = EventBus.getInstance(),
	) {}

	async claim(discordId: string, now: Date = new Date(), atomicProgress = false): Promise<ClaimDailyResult> {
		const result = await db.transaction(async (tx): Promise<ClaimDailyResult> => {
			if (!(await this.repo.hasBag(tx, discordId))) return { status: 'not-registered' };

			const state = await this.repo.getDailyState(tx, discordId);
			if (!state) return { status: 'not-registered' };

			// Menu actions may wait on another transaction across the daily reset.
			const claimTime = atomicProgress ? new Date() : now;
			const todayKey = DailyCycle.keyAt(claimTime);
			const yesterdayKey = DailyCycle.yesterdayKeyAt(claimTime);

			if (state.lastDailyClaimDate === todayKey) {
				return { status: 'already-claimed', overall: state.overallStreak };
			}

			const consecutive = state.lastDailyClaimDate === yesterdayKey;
			const monthly = consecutive ? (state.monthlyStreak % 30) + 1 : 1;
			const overall = consecutive ? state.overallStreak + 1 : 1;

			const reward = DailyRewardTable.rewardForDay(monthly);
			const milestone = DailyRewardTable.milestoneForStreak(overall);

			const before = await this.repo.applyReward(tx, discordId, {
				credux: reward.credux,
				shards: reward.shards,
				chestColumn: reward.chestColumn,
				milestoneColumn: milestone?.chestColumn ?? null,
			});

			await this.repo.updateStreak(tx, discordId, { monthly, overall, todayKey });

			await this.repo.logCurrencyChange(
				tx,
				discordId,
				'Daily',
				'credux',
				before.creduxAfter - reward.credux,
				before.creduxAfter,
			);
			await this.repo.logCurrencyChange(
				tx,
				discordId,
				'Daily',
				'belief_shards',
				before.beliefShardsAfter - reward.shards,
				before.beliefShardsAfter,
			);
			await this.repo.logChestChange(
				tx,
				discordId,
				'Daily',
				reward.chestColumn,
				before.chestCountAfter - 1,
				before.chestCountAfter,
			);
			if (milestone && before.milestoneChestCountAfter != null) {
				await this.repo.logChestChange(
					tx,
					discordId,
					'Daily',
					milestone.chestColumn,
					before.milestoneChestCountAfter - 1,
					before.milestoneChestCountAfter,
				);
			}

			if (atomicProgress) await applyGameplayProgress(tx, discordId, 'daily', claimTime);
			return {
				status: 'ok',
				day: overall,
				monthly,
				overall,
				credux: reward.credux,
				shards: reward.shards,
				chestLabel: reward.chestLabel,
				milestoneChestLabel: milestone?.chestLabel ?? null,
			};
		});

		if (result.status === 'ok') {
			this.events.emit('daily.claimed', { discordId, streak: result.overall, progressApplied: atomicProgress });
		}
		return result;
	}
}
