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

export type QuestRow = typeof dailyQuests.$inferSelect;
export type WeeklyQuestRow = typeof weeklyQuests.$inferSelect;

/**
 * Quest daily/weekly (M7): sinh lazily theo ngày/ISO-week Manila — không cần
 * cron, quest xuất hiện đúng lúc người chơi chạm vào hệ thống. Progress đến
 * qua EventBus (`progress`), hoàn thành tự cộng thưởng trong cùng giao dịch.
 * Đủ 3 daily → +1 Sacred Relic; đủ 3 weekly → Weekly Grand claim được.
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
			const day = DailyCycle.keyAt();
			const { week } = weekWindowAt();
			const dailies = await this.ensureDailyQuests(tx, discordId, day);
			const weeklies = await this.ensureWeeklyQuests(tx, discordId, week);
			const lines = dailies.map((q) =>
				this.formatQuest(
					q,
					this.labelFor(DAILY_POOL, q.questType as QuestType),
					'shards',
					q.rewardBeliefShards,
				),
			);
			const weeklyLines = weeklies.map((q) =>
				this.formatQuest(q, this.labelFor(WEEKLY_POOL, q.questType as QuestType), 'valor', q.rewardValor),
			);
			const [grand] = await tx
				.select()
				.from(weeklyGrand)
				.where(and(eq(weeklyGrand.discordId, discordId), eq(weeklyGrand.questWeek, week)))
				.limit(1);
			const allDaily = dailies.length > 0 && dailies.every((q) => q.completed);
			const allWeekly = weeklies.length > 0 && weeklies.every((q) => q.completed);
			return (
				`📜 **Daily quests (${day})**\n${lines.join('\n')}` +
				(allDaily ? `\n✅ Đủ 3 daily — đã nhận +${DAILY_ALL_COMPLETE_RELICS} Sacred Relic.` : '') +
				`\n\n🗓️ **Weekly quests (tuần ${week})**\n${weeklyLines.join('\n')}` +
				(allWeekly
					? grand?.claimed
						? '\n✅ Weekly grand đã claim tuần này.'
						: '\n🎁 Đủ 3 weekly — dùng `/quest claim` nhận Weekly Grand!'
					: '')
			);
		});
	}

	async refresh(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const [user] = await tx.select().from(users).where(eq(users.discordId, discordId)).limit(1).for('update');
			if (!user) return 'Dùng /register trước.';
			const day = DailyCycle.keyAt();
			if (user.lastQuestRefreshDate === day) return 'Đã refresh daily hôm nay. Reset lúc 00:00 Asia/Manila.';
			await tx
				.delete(dailyQuests)
				.where(
					and(
						eq(dailyQuests.discordId, discordId),
						eq(dailyQuests.questDate, day),
						eq(dailyQuests.completed, false),
					),
				);
			await this.ensureDailyQuests(tx, discordId, day);
			await tx
				.update(users)
				.set({ questRefreshesToday: 1, lastQuestRefreshDate: day })
				.where(eq(users.discordId, discordId));
			return 'Đã reroll daily quests — /quest để xem bộ mới.';
		});
	}

	async claimWeeklyGrand(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const { week } = weekWindowAt();
			const weeklies = await this.ensureWeeklyQuests(tx, discordId, week);
			if (weeklies.length === 0 || !weeklies.every((q) => q.completed)) return 'Chưa đủ 3 weekly quest.';
			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) return 'Dùng /register trước.';
			const [grand] = await tx
				.insert(weeklyGrand)
				.values({ discordId, questWeek: week, claimed: true })
				.onConflictDoNothing()
				.returning();
			if (!grand) return 'Weekly grand tuần này đã nhận rồi.';
			await tx
				.update(usersBag)
				.set({
					diamondChest: bag.diamondChest + WEEKLY_GRAND.diamondChest,
					credux: bag.credux + WEEKLY_GRAND.credux,
					lifetimeCreduxEarned: bag.lifetimeCreduxEarned + WEEKLY_GRAND.credux,
				})
				.where(eq(usersBag.discordId, discordId));
			await this.reputation.awardInTx(tx, discordId, 'weekly_grand');
			return `🎁 Weekly Grand! +${WEEKLY_GRAND.credux.toLocaleString()} Credux · +${WEEKLY_GRAND.diamondChest} Diamond Chest.`;
		});
	}

	private formatQuest(
		quest: { currentCount: number; targetCount: number; completed: boolean; rewardCredux: number },
		label: string,
		bonusKind: 'shards' | 'valor',
		bonus: number,
	): string {
		const mark = quest.completed ? '✅' : `${Math.min(quest.currentCount, quest.targetCount)}/${quest.targetCount}`;
		const bonusLabel = bonusKind === 'shards' ? `${bonus} shards` : `${bonus} valor`;
		return `${mark} — ${label} (+${quest.rewardCredux.toLocaleString()} Credux, +${bonusLabel})`;
	}

	private labelFor(pool: readonly QuestTemplate[], type: QuestType): string {
		return pool.find((t) => t.type === type)?.label ?? type;
	}

	private async ensureDailyQuests(tx: Executor, discordId: string, day: string): Promise<QuestRow[]> {
		const existing = await tx
			.select()
			.from(dailyQuests)
			.where(and(eq(dailyQuests.discordId, discordId), eq(dailyQuests.questDate, day)));
		if (existing.length > 0) return existing;
		const rng = createRng(createSecureSeed());
		await tx.insert(dailyQuests).values(
			this.rollTemplates(DAILY_POOL, rng).map((t) => ({
				discordId,
				questType: t.type,
				targetCount: t.target,
				rewardCredux: randInt(rng, DAILY_REWARD.credux),
				rewardBeliefShards: randInt(rng, DAILY_REWARD.shards),
				questDate: day,
			})),
		);
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
		await tx.insert(weeklyQuests).values(
			this.rollTemplates(WEEKLY_POOL, rng).map((t) => ({
				discordId,
				questType: t.type,
				targetCount: t.target,
				rewardCredux: randInt(rng, WEEKLY_REWARD.credux),
				rewardValor: randInt(rng, WEEKLY_REWARD.valor),
				questWeek: week,
			})),
		);
		return tx
			.select()
			.from(weeklyQuests)
			.where(and(eq(weeklyQuests.discordId, discordId), eq(weeklyQuests.questWeek, week)));
	}

	/** QUESTS_PER_CYCLE distinct templates per cycle — no duplicate types. */
	private rollTemplates(pool: readonly QuestTemplate[], rng: () => number): QuestTemplate[] {
		const remaining = [...pool];
		const picked: QuestTemplate[] = [];
		for (let i = 0; i < QUESTS_PER_CYCLE && remaining.length > 0; i++) {
			const template = choose(remaining, rng);
			remaining.splice(remaining.indexOf(template), 1);
			picked.push(template);
		}
		return picked;
	}

	private async bumpDaily(tx: Executor, discordId: string, day: string, questType: QuestType): Promise<void> {
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
			.limit(1);
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
			.limit(1);
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
