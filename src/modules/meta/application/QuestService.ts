import { formatNumber } from '../../../shared/ui/text/format.js';
import {
	QUEST_PROGRESS_LINE,
	QUEST_FLOW_TEXT,
	DAILY_QUEST_LABELS,
	QUEST_BONUS_SHARDS,
	QUEST_BONUS_VALOR,
	QUEST_CLAIM_ALREADY,
	QUEST_CLAIM_NOT_READY,
	QUEST_CLAIM_OK,
	QUEST_DAILY_ALL_DONE,
	QUEST_DAILY_HEADER,
	QUEST_GRAND_CLAIMED,
	QUEST_GRAND_READY,
	QUEST_REFRESH_DONE,
	QUEST_REFRESH_LIMIT,
	QUEST_REGISTER_FIRST,
	QUEST_WEEKLY_HEADER,
	WEEKLY_QUEST_LABELS,
} from '../../../shared/ui/text/quest.js';
import { QUEST_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';

import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { QuestRepository } from '../infrastructure/QuestRepository.js';
import type { Executor } from '../../../db/client.js';
import type { dailyQuests, weeklyQuests } from '../../../db/schema.js';
import {
	DAILY_ALL_COMPLETE_RELICS,
	DAILY_POOL,
	DAILY_REWARD,
	QUESTS_PER_CYCLE,
	WEEKLY_GRAND,
	WEEKLY_POOL,
	WEEKLY_REWARD,
	type QuestTemplate,
	type QuestType,
} from '../../../shared/config/quests.js';
import { randInt } from '../../../shared/config/raidLoot.js';
import { pickQuestTemplates } from './QuestTemplatePicker.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { DailyCycle } from '../../../shared/utils/dailyCycle.js';
import { weekWindowAt } from '../../../shared/config/ranked.js';
import { ReputationService } from './ReputationService.js';

import { ICONS } from '../../../shared/ui/text/icons.js';
import { systemClock, type Clock } from '../../../shared/kernel/clock.js';
import { AppError, err, ok, type Result } from '../../../shared/kernel/Result.js';

export type QuestRow = typeof dailyQuests.$inferSelect;
export type WeeklyQuestRow = typeof weeklyQuests.$inferSelect;
export interface QuestSnapshot {
	day: string;
	week: string;
	dailies: QuestRow[];
	weeklies: WeeklyQuestRow[];
	refreshAvailable: boolean;
	grandClaimed: boolean;
	grandReady: boolean;
}

export interface QuestDependencies {
	persistence: PersistenceContext;
	clock?: Clock;
	queries?: Pick<
		QuestRepository,
		| 'findWeeklyGrand'
		| 'lockBag'
		| 'lockUser'
		| 'deleteIncompleteDailyQuests'
		| 'listDailyQuests'
		| 'insertDailyQuests'
		| 'updateRefreshState'
		| 'lockRewardBag'
		| 'insertWeeklyGrand'
		| 'updateWeeklyGrandBalances'
		| 'listWeeklyQuests'
		| 'insertWeeklyQuests'
		| 'lockDailyQuest'
		| 'updateDailyProgress'
		| 'updateDailyRewardBalances'
		| 'insertDailyCompletionReward'
		| 'updateCompletionRelics'
		| 'lockWeeklyQuest'
		| 'updateWeeklyProgress'
		| 'updateWeeklyRewardBalances'
	>;
}

/**
 * Quest daily/weekly (M7): sinh lazily theo ngày/ISO-week Việt Nam — không cần
 * cron, quest xuất hiện đúng lúc người chơi chạm vào hệ thống. Progress đến
 * qua coordinator trong transaction hành động (`progressInTx`), hoàn thành tự cộng thưởng trong cùng giao dịch.
 * Đủ 3 daily → +1 Sacred Relic; đủ 3 weekly → Weekly Grand claim được.
 * Toàn bộ wording nằm ở src/shared/ui/text/quest.ts.
 */

export class QuestService {
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly reputation: Pick<ReputationService, 'awardInTx'>;
	private readonly queries: NonNullable<QuestDependencies['queries']>;
	constructor(reputation?: Pick<ReputationService, 'awardInTx'>, options: QuestDependencies = {} as QuestDependencies) {
		this.persistence = requirePersistence(options, 'QuestService');
		this.clock = options.clock ?? systemClock;
		this.reputation = reputation ?? new ReputationService({ persistence: this.persistence, clock: this.clock });
		this.queries = options.queries ?? new QuestRepository();
	}

	/** Standalone administrative/test entry; gameplay uses progressInTx. */
	async progress(discordId: string, questType: QuestType, amount = 1): Promise<void> {
		await this.persistence.unitOfWork.run(async (tx) =>
			this.progressInTx(tx, discordId, questType, this.clock.now(), amount),
		);
	}

	async progressInTx(
		tx: Executor,
		discordId: string,
		questType: QuestType,
		now: Date | undefined = undefined,
		amount = 1,
	): Promise<void> {
		const at = now ?? this.clock.now();
		if (!Number.isSafeInteger(amount) || amount < 1)
			throw new AppError('QUEST_INVALID_PROGRESS', QUEST_ERROR_TEXT.invalidProgress);
		if (!(await this.lockPlayer(tx, discordId))) return;
		const day = DailyCycle.keyAt(at);
		const { key: week } = weekWindowAt(at);
		await this.ensureDailyQuests(tx, discordId, day);
		await this.ensureWeeklyQuests(tx, discordId, week);
		await this.bumpDaily(tx, discordId, day, questType, at, amount);
		await this.bumpWeekly(tx, discordId, week, questType, at, amount);
	}

	async view(discordId: string): Promise<Result<string, AppError>> {
		const snapshot = await this.snapshot(discordId);
		if (!snapshot) return err(new AppError('QUEST_NOT_REGISTERED', QUEST_REGISTER_FIRST));
		const { day, week, dailies, weeklies } = snapshot;
		const lines = dailies.map((q) =>
			this.formatQuest(q, DAILY_QUEST_LABELS[q.questType as QuestType], 'shards', q.rewardBeliefShards),
		);
		const weeklyLines = weeklies.map((q) =>
			this.formatQuest(q, WEEKLY_QUEST_LABELS[q.questType as QuestType], 'valor', q.rewardValor),
		);
		const allDaily = dailies.length > 0 && dailies.every((q) => q.completed);
		const allWeekly = weeklies.length > 0 && weeklies.every((q) => q.completed);
		let grandFooter = '';
		if (allWeekly) grandFooter = snapshot.grandClaimed ? QUEST_GRAND_CLAIMED : QUEST_GRAND_READY;
		return ok(
			QUEST_DAILY_HEADER(day) +
				(lines.length ? '\n' + lines.join('\n') : '') +
				(allDaily ? QUEST_DAILY_ALL_DONE(DAILY_ALL_COMPLETE_RELICS) : '') +
				QUEST_WEEKLY_HEADER(week) +
				(weeklyLines.length ? '\n' + weeklyLines.join('\n') : '') +
				grandFooter,
		);
	}

	async snapshot(discordId: string): Promise<QuestSnapshot | null> {
		// Deliberate write-in-read: the first menu open of a day/week lazily
		// generates that cycle's quests inside the same locked transaction
		// (bag+user locks serialize concurrent opens). Callers must treat
		// snapshot() as a normal mutating use-case, not a pure query.
		return this.persistence.unitOfWork.run(async (tx) => {
			const user = await this.lockPlayer(tx, discordId);
			if (!user) return null;
			const at = this.clock.now();
			const day = DailyCycle.keyAt(at);
			const { key: week } = weekWindowAt(at);
			const dailies = await this.ensureDailyQuests(tx, discordId, day);
			const weeklies = await this.ensureWeeklyQuests(tx, discordId, week);
			const [grand] = await this.queries.findWeeklyGrand(tx, discordId, week);
			return {
				day,
				week,
				dailies,
				weeklies,
				refreshAvailable: user.lastQuestRefreshDate !== day,
				grandClaimed: !!grand?.claimed,
				grandReady:
					weeklies.length === QUESTS_PER_CYCLE && weeklies.every((q) => q.completed) && !grand?.claimed,
			};
		});
	}

	/** Serialize lazy generation and reward writes with daily/raid's bag-first lock. */
	private async lockPlayer(tx: Executor, discordId: string) {
		const [bag] = await this.queries.lockBag(tx, discordId);
		if (!bag) return null;
		// Keep FK key-share locks compatible (e.g. a title grant holding character).
		const [user] = await this.queries.lockUser(tx, discordId);
		return user ?? null;
	}

	async refresh(discordId: string, expectedDay?: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx): Promise<Result<string, AppError>> => {
			const user = await this.lockPlayer(tx, discordId);
			if (!user) return err(new AppError('QUEST_NOT_REGISTERED', QUEST_REGISTER_FIRST));
			const day = DailyCycle.keyAt(this.clock.now());
			if (expectedDay && expectedDay !== day)
				return err(new AppError('QUEST_DAY_CHANGED', QUEST_FLOW_TEXT.dayChanged));
			if (user.lastQuestRefreshDate === day) return err(new AppError('QUEST_REFRESH_LIMIT', QUEST_REFRESH_LIMIT));
			await this.queries.deleteIncompleteDailyQuests(tx, discordId, day);
			// Completed quests stay; reroll only tops the board back up to
			// QUESTS_PER_CYCLE — ensureDailyQuests would see the kept rows and
			// return early without replacing the deleted ones.
			const kept = await this.queries.listDailyQuests(tx, discordId, day);
			const missing = Math.max(0, QUESTS_PER_CYCLE - kept.length);
			if (missing > 0) {
				const rng = createRng(createSecureSeed());
				const usedTypes = new Set(kept.map((q) => q.questType));
				const pool = DAILY_POOL.filter((t) => !usedTypes.has(t.type));
				await this.queries.insertDailyQuests(
					tx,
					this.rollTemplates(pool, rng, missing).map((t) => ({
						discordId,
						questType: t.type,
						targetCount: t.target,
						rewardCredux: randInt(rng, DAILY_REWARD.credux),
						rewardBeliefShards: randInt(rng, DAILY_REWARD.shards),
						questDate: day,
					})),
				);
			}
			await this.queries.updateRefreshState(tx, discordId, {
				// Counter resets on day change (the early return above
				// guarantees a new day here); kept as a real counter so a
				// future N-per-day limit can gate on it instead of the date.
				questRefreshesToday: user.lastQuestRefreshDate === day ? user.questRefreshesToday + 1 : 1,
				lastQuestRefreshDate: day,
			});
			return ok(QUEST_REFRESH_DONE);
		});
	}

	async claimWeeklyGrand(discordId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx): Promise<Result<string, AppError>> => {
			const user = await this.lockPlayer(tx, discordId);
			if (!user) return err(new AppError('QUEST_NOT_REGISTERED', QUEST_REGISTER_FIRST));
			const now = this.clock.now();
			const { key: week } = weekWindowAt(now);
			// Current week first; previous-week grace second (a board finished
			// Sunday 23:59 must still be claimable Monday 00:01 — without it
			// the grand silently vanishes at the week boundary).
			const current = await this.tryClaimWeek(tx, discordId, week);
			if (current) return current;
			const prevWeek = weekWindowAt(new Date(now.getTime() - 7 * 86400000)).key;
			if (prevWeek !== week) {
				const prev = await this.tryClaimWeek(tx, discordId, prevWeek);
				if (prev) return prev;
			}
			return err(new AppError('QUEST_CLAIM_NOT_READY', QUEST_CLAIM_NOT_READY));
		});
	}

	/** Attempt the grand for one week key; null = not eligible (caller falls through). */
	private async tryClaimWeek(
		tx: Executor,
		discordId: string,
		week: string,
	): Promise<Result<string, AppError> | null> {
		const weeklies = await this.queries.listWeeklyQuests(tx, discordId, week);
		if (weeklies.length === 0 || !weeklies.every((q) => q.completed)) return null;
		const [bag] = await this.queries.lockRewardBag(tx, discordId);
		if (!bag) return err(new AppError('QUEST_NOT_REGISTERED', QUEST_REGISTER_FIRST));
		const [grand] = await this.queries.insertWeeklyGrand(tx, { discordId, questWeek: week, claimed: true });
		if (!grand) return err(new AppError('QUEST_CLAIM_ALREADY', QUEST_CLAIM_ALREADY));
		await this.queries.updateWeeklyGrandBalances(tx, discordId, {
			diamondChest: bag.diamondChest + WEEKLY_GRAND.diamondChest,
			credux: bag.credux + WEEKLY_GRAND.credux,
			lifetimeCreduxEarned: bag.lifetimeCreduxEarned + WEEKLY_GRAND.credux,
		});
		await this.reputation.awardInTx(tx, discordId, 'weekly_grand');
		return ok(QUEST_CLAIM_OK(formatNumber(WEEKLY_GRAND.credux), WEEKLY_GRAND.diamondChest));
	}

	private formatQuest(
		quest: { currentCount: number; targetCount: number; completed: boolean; rewardCredux: number },
		label: string,
		bonusKind: 'shards' | 'valor',
		bonus: number,
	): string {
		const mark = quest.completed
			? ICONS.status.completed
			: `${Math.min(quest.currentCount, quest.targetCount)}/${quest.targetCount}`;
		const bonusLabel = bonusKind === 'shards' ? QUEST_BONUS_SHARDS(bonus) : QUEST_BONUS_VALOR(bonus);
		return QUEST_PROGRESS_LINE(mark, label, formatNumber(quest.rewardCredux), bonusLabel);
	}

	private async ensureDailyQuests(tx: Executor, discordId: string, day: string): Promise<QuestRow[]> {
		const existing = await this.queries.listDailyQuests(tx, discordId, day);
		if (existing.length > 0) return existing;
		const rng = createRng(createSecureSeed());
		// Callers hold the player's bag/user locks: a cycle is generated once,
		// even when two menus open simultaneously and roll different templates.
		await this.queries.insertDailyQuests(
			tx,
			this.rollTemplates(DAILY_POOL, rng).map((t) => ({
				discordId,
				questType: t.type,
				targetCount: t.target,
				rewardCredux: randInt(rng, DAILY_REWARD.credux),
				rewardBeliefShards: randInt(rng, DAILY_REWARD.shards),
				questDate: day,
			})),
		);
		return this.queries.listDailyQuests(tx, discordId, day);
	}

	private async ensureWeeklyQuests(tx: Executor, discordId: string, week: string): Promise<WeeklyQuestRow[]> {
		const existing = await this.queries.listWeeklyQuests(tx, discordId, week);
		if (existing.length > 0) return existing;
		const rng = createRng(createSecureSeed());
		await this.queries.insertWeeklyQuests(
			tx,
			this.rollTemplates(WEEKLY_POOL, rng).map((t) => ({
				discordId,
				questType: t.type,
				targetCount: t.target,
				rewardCredux: randInt(rng, WEEKLY_REWARD.credux),
				rewardValor: randInt(rng, WEEKLY_REWARD.valor),
				questWeek: week,
			})),
		);
		return this.queries.listWeeklyQuests(tx, discordId, week);
	}

	/** `count` distinct templates from `pool` — delegates to QuestTemplatePicker (SRP). */
	private rollTemplates(
		pool: readonly QuestTemplate[],
		rng: () => number,
		count: number = QUESTS_PER_CYCLE,
	): QuestTemplate[] {
		return pickQuestTemplates(pool, rng, count);
	}

	private async bumpDaily(
		tx: Executor,
		discordId: string,
		day: string,
		questType: QuestType,
		now: Date,
		amount: number,
	): Promise<void> {
		// Row lock: two concurrent progress events for the same quest must not
		// read the same counter (read–modify–write would drop one increment).
		const [quest] = await this.queries.lockDailyQuest(tx, discordId, day, questType);
		if (!quest || quest.completed) return;
		const progress = advanceQuest(quest, amount);
		await this.queries.updateDailyProgress(tx, quest.id, progress);
		if (!progress.completed) return;

		const [bag] = await this.queries.lockRewardBag(tx, discordId);
		if (!bag) return;
		await this.queries.updateDailyRewardBalances(tx, discordId, {
			credux: bag.credux + quest.rewardCredux,
			beliefShards: bag.beliefShards + quest.rewardBeliefShards,
			lifetimeCreduxEarned: bag.lifetimeCreduxEarned + quest.rewardCredux,
		});
		await this.reputation.awardInTx(tx, discordId, 'quest_complete', now);

		const rows = await this.queries.listDailyQuests(tx, discordId, day);
		if (rows.length > 0 && rows.every((q) => q.completed)) {
			const [granted] = await this.queries.insertDailyCompletionReward(tx, {
				discordId,
				questDate: day,
				sacredRelics: DAILY_ALL_COMPLETE_RELICS,
			});
			if (granted) {
				await this.queries.updateCompletionRelics(tx, discordId, {
					sacredRelics: bag.sacredRelics + DAILY_ALL_COMPLETE_RELICS,
				});
			}
		}
	}

	private async bumpWeekly(
		tx: Executor,
		discordId: string,
		week: string,
		questType: QuestType,
		now: Date,
		amount: number,
	): Promise<void> {
		// Row lock — same lost-update protection as bumpDaily.
		const [quest] = await this.queries.lockWeeklyQuest(tx, discordId, week, questType);
		if (!quest || quest.completed) return;
		const progress = advanceQuest(quest, amount);
		await this.queries.updateWeeklyProgress(tx, quest.id, progress);
		if (!progress.completed) return;

		const [bag] = await this.queries.lockRewardBag(tx, discordId);
		if (!bag) return;
		await this.queries.updateWeeklyRewardBalances(tx, discordId, {
			credux: bag.credux + quest.rewardCredux,
			valorMedals: bag.valorMedals + quest.rewardValor,
			lifetimeCreduxEarned: bag.lifetimeCreduxEarned + quest.rewardCredux,
		});
		await this.reputation.awardInTx(tx, discordId, 'quest_complete', now);
	}
}

function advanceQuest(quest: { targetCount: number; currentCount: number }, amount: number) {
	const currentCount = Math.min(quest.targetCount, quest.currentCount + amount);
	return { currentCount, completed: currentCount >= quest.targetCount };
}
