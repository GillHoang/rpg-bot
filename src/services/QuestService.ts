import { and, eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { dailyQuestCompletionRewards, dailyQuests, users, usersBag, weeklyGrand, weeklyQuests } from '../db/schema.js';
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

/**
 * Quest daily/weekly (M7): sinh lazily theo ngày/ISO-week Manila — không cần
 * cron, quest xuất hiện đúng lúc người chơi chạm vào hệ thống. Progress đến
 * qua EventBus (`progress`), hoàn thành tự cộng thưởng trong cùng giao dịch.
 * Đủ 3 daily → +1 Sacred Relic; đủ 3 weekly → Weekly Grand claim được.
 * Toàn bộ wording nằm ở src/text/quest.ts.
 */
export class QuestService {
	constructor(private readonly reputation = new ReputationService()) {}

	/** Event-subscriber entry — opens its own transaction. */
	async progress(discordId: string, questType: QuestType): Promise<void> {
		await db.transaction(async (tx) => this.progressInTx(tx, discordId, questType));
	}

	async progressInTx(tx: Executor, discordId: string, questType: QuestType): Promise<void> {
		const day = DailyCycle.keyAt();
		const { week } = weekWindowAt();
		await this.ensureDailyQuests(tx, discordId, day);
		await this.ensureWeeklyQuests(tx, discordId, week);
		await this.bumpDaily(tx, discordId, day, questType);
		await this.bumpWeekly(tx, discordId, week, questType);
	}

	async view(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			// Guard before the lazy insert: quest rows FK to users, so generating
			// quests for an unregistered id would crash with a constraint error.
			const [user] = await tx.select().from(users).where(eq(users.discordId, discordId)).limit(1);
			if (!user) return QUEST_REGISTER_FIRST;
			const day = DailyCycle.keyAt();
			const { week } = weekWindowAt();
			const dailies = await this.ensureDailyQuests(tx, discordId, day);
			const weeklies = await this.ensureWeeklyQuests(tx, discordId, week);
			const lines = dailies.map((q) =>
				this.formatQuest(q, DAILY_QUEST_LABELS[q.questType as QuestType], 'shards', q.rewardBeliefShards),
			);
			const weeklyLines = weeklies.map((q) =>
				this.formatQuest(q, WEEKLY_QUEST_LABELS[q.questType as QuestType], 'valor', q.rewardValor),
			);
			const [grand] = await tx
				.select()
				.from(weeklyGrand)
				.where(and(eq(weeklyGrand.discordId, discordId), eq(weeklyGrand.questWeek, week)))
				.limit(1);
			const allDaily = dailies.length > 0 && dailies.every((q) => q.completed);
			const allWeekly = weeklies.length > 0 && weeklies.every((q) => q.completed);
			let grandFooter = '';
			if (allWeekly) grandFooter = grand?.claimed ? QUEST_GRAND_CLAIMED : QUEST_GRAND_READY;
			return (
				QUEST_DAILY_HEADER(day) +
				(lines.length ? '\n' + lines.join('\n') : '') +
				(allDaily ? QUEST_DAILY_ALL_DONE(DAILY_ALL_COMPLETE_RELICS) : '') +
				QUEST_WEEKLY_HEADER(week) +
				(weeklyLines.length ? '\n' + weeklyLines.join('\n') : '') +
				grandFooter
			);
		});
	}

	async refresh(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const [user] = await tx.select().from(users).where(eq(users.discordId, discordId)).limit(1).for('update');
			if (!user) return QUEST_REGISTER_FIRST;
			const day = DailyCycle.keyAt();
			if (user.lastQuestRefreshDate === day) return QUEST_REFRESH_LIMIT;
			await tx
				.delete(dailyQuests)
				.where(
					and(
						eq(dailyQuests.discordId, discordId),
						eq(dailyQuests.questDate, day),
						eq(dailyQuests.completed, false),
					),
				);
			// Completed quests stay; reroll only tops the board back up to
			// QUESTS_PER_CYCLE — ensureDailyQuests would see the kept rows and
			// return early without replacing the deleted ones.
			const kept = await tx
				.select()
				.from(dailyQuests)
				.where(and(eq(dailyQuests.discordId, discordId), eq(dailyQuests.questDate, day)));
			const missing = Math.max(0, QUESTS_PER_CYCLE - kept.length);
			if (missing > 0) {
				const rng = createRng(createSecureSeed());
				const usedTypes = new Set(kept.map((q) => q.questType));
				const pool = DAILY_POOL.filter((t) => !usedTypes.has(t.type));
				await tx
					.insert(dailyQuests)
					.values(
						this.rollTemplates(pool, rng, missing).map((t) => ({
							discordId,
							questType: t.type,
							targetCount: t.target,
							rewardCredux: randInt(rng, DAILY_REWARD.credux),
							rewardBeliefShards: randInt(rng, DAILY_REWARD.shards),
							questDate: day,
						})),
					)
					.onConflictDoNothing();
			}
			await tx
				.update(users)
				.set({ questRefreshesToday: 1, lastQuestRefreshDate: day })
				.where(eq(users.discordId, discordId));
			return QUEST_REFRESH_DONE;
		});
	}

	async claimWeeklyGrand(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const [user] = await tx.select().from(users).where(eq(users.discordId, discordId)).limit(1);
			if (!user) return QUEST_REGISTER_FIRST;
			const { week } = weekWindowAt();
			const weeklies = await this.ensureWeeklyQuests(tx, discordId, week);
			if (weeklies.length === 0 || !weeklies.every((q) => q.completed)) return QUEST_CLAIM_NOT_READY;
			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) return QUEST_REGISTER_FIRST;
			const [grand] = await tx
				.insert(weeklyGrand)
				.values({ discordId, questWeek: week, claimed: true })
				.onConflictDoNothing()
				.returning();
			if (!grand) return QUEST_CLAIM_ALREADY;
			await tx
				.update(usersBag)
				.set({
					diamondChest: bag.diamondChest + WEEKLY_GRAND.diamondChest,
					credux: bag.credux + WEEKLY_GRAND.credux,
					lifetimeCreduxEarned: bag.lifetimeCreduxEarned + WEEKLY_GRAND.credux,
				})
				.where(eq(usersBag.discordId, discordId));
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
		const mark = quest.completed ? ICONS.status.completed : `${Math.min(quest.currentCount, quest.targetCount)}/${quest.targetCount}`;
		const bonusLabel = bonusKind === 'shards' ? QUEST_BONUS_SHARDS(bonus) : QUEST_BONUS_VALOR(bonus);
		return `${mark} — ${label} (+${quest.rewardCredux.toLocaleString()} Credux, +${bonusLabel})`;
	}

	private async ensureDailyQuests(tx: Executor, discordId: string, day: string): Promise<QuestRow[]> {
		const existing = await tx
			.select()
			.from(dailyQuests)
			.where(and(eq(dailyQuests.discordId, discordId), eq(dailyQuests.questDate, day)));
		if (existing.length > 0) return existing;
		const rng = createRng(createSecureSeed());
		// Two racing callers both see zero rows: the unique (discordId, type, date)
		// constraint turns the second insert into a no-op instead of an error.
		await tx
			.insert(dailyQuests)
			.values(
				this.rollTemplates(DAILY_POOL, rng).map((t) => ({
					discordId,
					questType: t.type,
					targetCount: t.target,
					rewardCredux: randInt(rng, DAILY_REWARD.credux),
					rewardBeliefShards: randInt(rng, DAILY_REWARD.shards),
					questDate: day,
				})),
			)
			.onConflictDoNothing();
		return tx
			.select()
			.from(dailyQuests)
			.where(and(eq(dailyQuests.discordId, discordId), eq(dailyQuests.questDate, day)));
	}

	private async ensureWeeklyQuests(tx: Executor, discordId: string, week: number): Promise<WeeklyQuestRow[]> {
		const existing = await tx
			.select()
			.from(weeklyQuests)
			.where(and(eq(weeklyQuests.discordId, discordId), eq(weeklyQuests.questWeek, week)));
		if (existing.length > 0) return existing;
		const rng = createRng(createSecureSeed());
		await tx
			.insert(weeklyQuests)
			.values(
				this.rollTemplates(WEEKLY_POOL, rng).map((t) => ({
					discordId,
					questType: t.type,
					targetCount: t.target,
					rewardCredux: randInt(rng, WEEKLY_REWARD.credux),
					rewardValor: randInt(rng, WEEKLY_REWARD.valor),
					questWeek: week,
				})),
			)
			.onConflictDoNothing();
		return tx
			.select()
			.from(weeklyQuests)
			.where(and(eq(weeklyQuests.discordId, discordId), eq(weeklyQuests.questWeek, week)));
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

	private async bumpDaily(tx: Executor, discordId: string, day: string, questType: QuestType): Promise<void> {
		// Row lock: two concurrent progress events for the same quest must not
		// read the same counter (read–modify–write would drop one increment).
		const [quest] = await tx
			.select()
			.from(dailyQuests)
			.where(
				and(
					eq(dailyQuests.discordId, discordId),
					eq(dailyQuests.questDate, day),
					eq(dailyQuests.questType, questType),
				),
			)
			.limit(1)
			.for('update');
		if (!quest || quest.completed) return;
		const count = quest.currentCount + 1;
		const completed = count >= quest.targetCount;
		await tx.update(dailyQuests).set({ currentCount: count, completed }).where(eq(dailyQuests.id, quest.id));
		if (!completed) return;

		const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
		if (!bag) return;
		await tx
			.update(usersBag)
			.set({
				credux: bag.credux + quest.rewardCredux,
				beliefShards: bag.beliefShards + quest.rewardBeliefShards,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + quest.rewardCredux,
			})
			.where(eq(usersBag.discordId, discordId));
		await this.reputation.awardInTx(tx, discordId, 'quest_complete');

		const rows = await tx
			.select()
			.from(dailyQuests)
			.where(and(eq(dailyQuests.discordId, discordId), eq(dailyQuests.questDate, day)));
		if (rows.length > 0 && rows.every((q) => q.completed)) {
			const [granted] = await tx
				.insert(dailyQuestCompletionRewards)
				.values({ discordId, questDate: day, sacredRelics: DAILY_ALL_COMPLETE_RELICS })
				.onConflictDoNothing()
				.returning();
			if (granted) {
				await tx
					.update(usersBag)
					.set({ sacredRelics: bag.sacredRelics + DAILY_ALL_COMPLETE_RELICS })
					.where(eq(usersBag.discordId, discordId));
			}
		}
	}

	private async bumpWeekly(tx: Executor, discordId: string, week: number, questType: QuestType): Promise<void> {
		// Row lock — same lost-update protection as bumpDaily.
		const [quest] = await tx
			.select()
			.from(weeklyQuests)
			.where(
				and(
					eq(weeklyQuests.discordId, discordId),
					eq(weeklyQuests.questWeek, week),
					eq(weeklyQuests.questType, questType),
				),
			)
			.limit(1)
			.for('update');
		if (!quest || quest.completed) return;
		const count = quest.currentCount + 1;
		const completed = count >= quest.targetCount;
		await tx.update(weeklyQuests).set({ currentCount: count, completed }).where(eq(weeklyQuests.id, quest.id));
		if (!completed) return;

		const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
		if (!bag) return;
		await tx
			.update(usersBag)
			.set({
				credux: bag.credux + quest.rewardCredux,
				valorMedals: bag.valorMedals + quest.rewardValor,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + quest.rewardCredux,
			})
			.where(eq(usersBag.discordId, discordId));
		await this.reputation.awardInTx(tx, discordId, 'quest_complete');
	}
}
