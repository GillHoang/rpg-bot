import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { QuestRepository } from '../repositories/QuestRepository.js';
import type { Executor } from '../db/client.js';
import type { dailyQuests, weeklyQuests } from '../db/schema.js';
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
} from '../config/quests.js';
import { randInt } from '../config/raidLoot.js';
import { choose } from '../utils/weightedRandom.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { DailyCycle } from '../utils/dailyCycle.js';
import { weekWindowAt } from '../config/ranked.js';
import { ReputationService } from './ReputationService.js';
import {
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
} from '../text/quest.js';
import { ICONS } from '../text/icons.js';

export type QuestRow = typeof dailyQuests.$inferSelect;
export type WeeklyQuestRow = typeof weeklyQuests.$inferSelect;
export interface QuestSnapshot {
	day: string;
	week: number;
	dailies: QuestRow[];
	weeklies: WeeklyQuestRow[];
	refreshAvailable: boolean;
	grandClaimed: boolean;
	grandReady: boolean;
}

export interface QuestDependencies {
	persistence?: PersistenceContext;
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
 * Quest daily/weekly (M7): sinh lazily theo ngày/ISO-week Manila — không cần
 * cron, quest xuất hiện đúng lúc người chơi chạm vào hệ thống. Progress đến
 * qua EventBus (`progress`), hoàn thành tự cộng thưởng trong cùng giao dịch.
 * Đủ 3 daily → +1 Sacred Relic; đủ 3 weekly → Weekly Grand claim được.
 * Toàn bộ wording nằm ở src/text/quest.ts.
 */

export class QuestService {
	private readonly persistence: PersistenceContext;
	private readonly reputation: Pick<ReputationService, 'awardInTx'>;
	private readonly queries: NonNullable<QuestDependencies['queries']>;
	constructor(
		reputation: Pick<ReputationService, 'awardInTx'> | undefined = undefined,
		options: QuestDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.reputation = reputation ?? new ReputationService({ persistence: this.persistence });
		this.queries = options.queries ?? new QuestRepository();
	}

	/** Event-subscriber entry — opens its own transaction. */
	async progress(discordId: string, questType: QuestType): Promise<void> {
		await this.persistence.unitOfWork.run(async (tx) => this.progressInTx(tx, discordId, questType));
	}

	async progressInTx(tx: Executor, discordId: string, questType: QuestType, now = new Date()): Promise<void> {
		if (!(await this.lockPlayer(tx, discordId))) return;
		const day = DailyCycle.keyAt(now);
		const { week } = weekWindowAt(now);
		await this.ensureDailyQuests(tx, discordId, day);
		await this.ensureWeeklyQuests(tx, discordId, week);
		await this.bumpDaily(tx, discordId, day, questType, now);
		await this.bumpWeekly(tx, discordId, week, questType, now);
	}

	async view(discordId: string): Promise<string> {
		const snapshot = await this.snapshot(discordId);
		if (!snapshot) return QUEST_REGISTER_FIRST;
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
		return (
			QUEST_DAILY_HEADER(day) +
			(lines.length ? '\n' + lines.join('\n') : '') +
			(allDaily ? QUEST_DAILY_ALL_DONE(DAILY_ALL_COMPLETE_RELICS) : '') +
			QUEST_WEEKLY_HEADER(week) +
			(weeklyLines.length ? '\n' + weeklyLines.join('\n') : '') +
			grandFooter
		);
	}

	async snapshot(discordId: string): Promise<QuestSnapshot | null> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const user = await this.lockPlayer(tx, discordId);
			if (!user) return null;
			const day = DailyCycle.keyAt();
			const { week } = weekWindowAt();
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

	async refresh(discordId: string, expectedDay?: string): Promise<string> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const user = await this.lockPlayer(tx, discordId);
			if (!user) return QUEST_REGISTER_FIRST;
			const day = DailyCycle.keyAt();
			if (expectedDay && expectedDay !== day) return 'Đã sang ngày mới. Hãy xem lại nhiệm vụ trước khi đổi.';
			if (user.lastQuestRefreshDate === day) return QUEST_REFRESH_LIMIT;
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
			await this.queries.updateRefreshState(tx, discordId, { questRefreshesToday: 1, lastQuestRefreshDate: day });
			return QUEST_REFRESH_DONE;
		});
	}

	async claimWeeklyGrand(discordId: string): Promise<string> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const user = await this.lockPlayer(tx, discordId);
			if (!user) return QUEST_REGISTER_FIRST;
			const { week } = weekWindowAt();
			const weeklies = await this.ensureWeeklyQuests(tx, discordId, week);
			if (weeklies.length === 0 || !weeklies.every((q) => q.completed)) return QUEST_CLAIM_NOT_READY;
			const [bag] = await this.queries.lockRewardBag(tx, discordId);
			if (!bag) return QUEST_REGISTER_FIRST;
			const [grand] = await this.queries.insertWeeklyGrand(tx, { discordId, questWeek: week, claimed: true });
			if (!grand) return QUEST_CLAIM_ALREADY;
			await this.queries.updateWeeklyGrandBalances(tx, discordId, {
				diamondChest: bag.diamondChest + WEEKLY_GRAND.diamondChest,
				credux: bag.credux + WEEKLY_GRAND.credux,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + WEEKLY_GRAND.credux,
			});
			await this.reputation.awardInTx(tx, discordId, 'weekly_grand');
			return QUEST_CLAIM_OK(WEEKLY_GRAND.credux.toLocaleString(), WEEKLY_GRAND.diamondChest);
		});
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
		return `${mark} — ${label} (+${quest.rewardCredux.toLocaleString()} Credux, +${bonusLabel})`;
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

	private async ensureWeeklyQuests(tx: Executor, discordId: string, week: number): Promise<WeeklyQuestRow[]> {
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

	/** `count` distinct templates from `pool` — no duplicate types. */
	private rollTemplates(
		pool: readonly QuestTemplate[],
		rng: () => number,
		count: number = QUESTS_PER_CYCLE,
	): QuestTemplate[] {
		const remaining = [...pool];
		const picked: QuestTemplate[] = [];
		for (let i = 0; i < count && remaining.length > 0; i++) {
			const template = choose(remaining, rng);
			remaining.splice(remaining.indexOf(template), 1);
			picked.push(template);
		}
		return picked;
	}

	private async bumpDaily(
		tx: Executor,
		discordId: string,
		day: string,
		questType: QuestType,
		now: Date,
	): Promise<void> {
		// Row lock: two concurrent progress events for the same quest must not
		// read the same counter (read–modify–write would drop one increment).
		const [quest] = await this.queries.lockDailyQuest(tx, discordId, day, questType);
		if (!quest || quest.completed) return;
		const count = quest.currentCount + 1;
		const completed = count >= quest.targetCount;
		await this.queries.updateDailyProgress(tx, quest.id, { currentCount: count, completed });
		if (!completed) return;

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
		week: number,
		questType: QuestType,
		now: Date,
	): Promise<void> {
		// Row lock — same lost-update protection as bumpDaily.
		const [quest] = await this.queries.lockWeeklyQuest(tx, discordId, week, questType);
		if (!quest || quest.completed) return;
		const count = quest.currentCount + 1;
		const completed = count >= quest.targetCount;
		await this.queries.updateWeeklyProgress(tx, quest.id, { currentCount: count, completed });
		if (!completed) return;

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
