import { and, eq } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import {
	dailyQuestCompletionRewards,
	dailyQuests,
	users,
	usersBag,
	weeklyGrand,
	weeklyQuests,
} from '../../../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class QuestRepository {
	async findWeeklyGrand(executor: Executor, discordId: string, week: string) {
		return executor
			.select()
			.from(weeklyGrand)
			.where(and(eq(weeklyGrand.discordId, discordId), eq(weeklyGrand.questWeek, week)));
	}

	async lockBag(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}

	async lockUser(executor: Executor, discordId: string) {
		return executor.select().from(users).where(eq(users.discordId, discordId)).for('no key update');
	}

	async deleteIncompleteDailyQuests(executor: Executor, discordId: string, day: string) {
		return executor
			.delete(dailyQuests)
			.where(
				and(
					eq(dailyQuests.discordId, discordId),
					eq(dailyQuests.questDate, day),
					eq(dailyQuests.completed, false),
				),
			);
	}

	async listDailyQuests(executor: Executor, discordId: string, day: string) {
		return executor
			.select()
			.from(dailyQuests)
			.where(and(eq(dailyQuests.discordId, discordId), eq(dailyQuests.questDate, day)));
	}

	async insertDailyQuests(executor: Executor, values: (typeof dailyQuests.$inferInsert)[]) {
		return executor.insert(dailyQuests).values(values).onConflictDoNothing();
	}

	async updateRefreshState(executor: Executor, discordId: string, values: Partial<typeof users.$inferInsert>) {
		return executor.update(users).set(values).where(eq(users.discordId, discordId));
	}

	async lockRewardBag(executor: Executor, discordId: string) {
		return executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
	}

	async insertWeeklyGrand(executor: Executor, values: typeof weeklyGrand.$inferInsert) {
		return executor.insert(weeklyGrand).values(values).onConflictDoNothing().returning();
	}

	async updateWeeklyGrandBalances(
		executor: Executor,
		discordId: string,
		values: Partial<typeof usersBag.$inferInsert>,
	) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async listWeeklyQuests(executor: Executor, discordId: string, week: string) {
		return executor
			.select()
			.from(weeklyQuests)
			.where(and(eq(weeklyQuests.discordId, discordId), eq(weeklyQuests.questWeek, week)));
	}

	async insertWeeklyQuests(executor: Executor, values: (typeof weeklyQuests.$inferInsert)[]) {
		return executor.insert(weeklyQuests).values(values).onConflictDoNothing();
	}

	async lockDailyQuest(executor: Executor, discordId: string, day: string, questType: string) {
		return executor
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
	}

	async updateDailyProgress(executor: Executor, id: number, values: Partial<typeof dailyQuests.$inferInsert>) {
		return executor.update(dailyQuests).set(values).where(eq(dailyQuests.id, id));
	}

	async updateDailyRewardBalances(
		executor: Executor,
		discordId: string,
		values: Partial<typeof usersBag.$inferInsert>,
	) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async insertDailyCompletionReward(executor: Executor, values: typeof dailyQuestCompletionRewards.$inferInsert) {
		return executor.insert(dailyQuestCompletionRewards).values(values).onConflictDoNothing().returning();
	}

	async updateCompletionRelics(executor: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async lockWeeklyQuest(executor: Executor, discordId: string, week: string, questType: string) {
		return executor
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
	}

	async updateWeeklyProgress(executor: Executor, id: number, values: Partial<typeof weeklyQuests.$inferInsert>) {
		return executor.update(weeklyQuests).set(values).where(eq(weeklyQuests.id, id));
	}

	async updateWeeklyRewardBalances(
		executor: Executor,
		discordId: string,
		values: Partial<typeof usersBag.$inferInsert>,
	) {
		return executor.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}
}
