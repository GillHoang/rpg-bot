import { ok, type Result, AppError } from '../../../shared/kernel/Result.js';
import type { UseCase } from '../../../shared/kernel/UseCase.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';
import { DailyRepository } from '../infrastructure/DailyRepository.js';
import { DailyRewardTable } from '../domain/DailyRewardTable.js';
import { DailyCycle } from '../../../shared/utils/dailyCycle.js';
import { ECONOMY_CONFIG } from '../config.js';
import { ECONOMY_MODULE_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import type { ClaimDailyOptions, DailyEventsPort, DailyRepoPort, ProgressPort } from './ports.js';
import { systemClock, type Clock } from '../../../shared/kernel/clock.js';
import type { ClaimDailyResult } from './types.js';

export interface ClaimDailyInput {
	discordId: string;
	now?: Date;
}

/**
 * Owns the daily-attendance claim transaction. Two counters: monthlyStreak
 * (rolling 1-30 reward cycle) and overallStreak (consecutive-day streak).
 * Progress + reward commit atomically; the domain event fires after commit.
 */
export class ClaimDailyUseCase implements UseCase<ClaimDailyInput, ClaimDailyResult> {
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly repo: DailyRepoPort;
	private readonly events: DailyEventsPort;
	private readonly progress: ProgressPort;

	constructor(repo?: DailyRepoPort, events?: DailyEventsPort, options: ClaimDailyOptions = {} as ClaimDailyOptions) {
		this.persistence = requirePersistence(options, 'ClaimDailyUseCase');
		this.clock = options.clock ?? systemClock;
		this.repo = repo ?? new DailyRepository();
		this.events = events ?? new EventBus();
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
	}

	/** Direct claim entry point used by the command and the menu. */
	async claim(discordId: string, now?: Date): Promise<ClaimDailyResult> {
		const result = await this.execute({ discordId, now });
		if (!result.ok) throw result.error;
		return result.value;
	}

	async execute(input: ClaimDailyInput): Promise<Result<ClaimDailyResult, AppError>> {
		if (!input.discordId) {
			return {
				ok: false,
				error: new AppError('VALIDATION_EMPTY_DISCORD_ID', ECONOMY_MODULE_ERROR_TEXT.emptyDiscordId),
			};
		}
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<ClaimDailyResult> => {
			if (!(await this.repo.hasBag(tx, input.discordId))) return { status: 'not-registered' };

			const state = await this.repo.getDailyState(tx, input.discordId);
			if (!state) return { status: 'not-registered' };

			// Menu actions may wait on another transaction across the daily reset.
			const claimTime = input.now ?? this.clock.now();
			const todayKey = DailyCycle.keyAt(claimTime);
			const yesterdayKey = DailyCycle.yesterdayKeyAt(claimTime);

			if (state.lastDailyClaimDate === todayKey) {
				return { status: 'already-claimed', overall: state.overallStreak };
			}
			// A claim date in the future means the clock moved backwards —
			// never reset the streak or pay out again on top of it.
			if (state.lastDailyClaimDate !== null && state.lastDailyClaimDate > todayKey) {
				return { status: 'already-claimed', overall: state.overallStreak };
			}

			const consecutive = state.lastDailyClaimDate === yesterdayKey;
			const monthly = consecutive ? (state.monthlyStreak % ECONOMY_CONFIG.monthlyCycleLength) + 1 : 1;
			const overall = consecutive ? state.overallStreak + 1 : 1;

			const reward = DailyRewardTable.rewardForDay(monthly);
			const milestone = DailyRewardTable.milestoneForStreak(overall);

			const before = await this.repo.applyReward(tx, input.discordId, {
				credux: reward.credux,
				shards: reward.shards,
				chestColumn: reward.chestColumn,
				milestoneColumn: milestone?.chestColumn ?? null,
			});

			await this.repo.updateStreak(tx, input.discordId, { monthly, overall, todayKey });

			await this.repo.logCurrencyChange(
				tx,
				input.discordId,
				'Daily',
				'credux',
				before.creduxAfter - reward.credux,
				before.creduxAfter,
			);
			await this.repo.logCurrencyChange(
				tx,
				input.discordId,
				'Daily',
				'belief_shards',
				before.beliefShardsAfter - reward.shards,
				before.beliefShardsAfter,
			);
			await this.repo.logChestChange(
				tx,
				input.discordId,
				'Daily',
				reward.chestColumn,
				before.chestCountAfter - 1,
				before.chestCountAfter,
			);
			if (milestone && before.milestoneChestCountAfter != null) {
				await this.repo.logChestChange(
					tx,
					input.discordId,
					'Daily',
					milestone.chestColumn,
					before.milestoneChestCountAfter - 1,
					before.milestoneChestCountAfter,
				);
			}

			await this.progress.apply(tx, input.discordId, 'daily', claimTime);
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
			this.events.emit('daily.claimed', {
				discordId: input.discordId,
				streak: result.overall,
				progressApplied: true,
			});
		}
		return ok(result);
	}
}
