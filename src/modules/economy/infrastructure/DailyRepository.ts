import { DAILY_REPOSITORY_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { eq } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { users, usersBag, gameLogs } from '../../../db/schema.js';
import type { ChestColumn } from '../domain/DailyRewardTable.js';

export interface DailyState {
	monthlyStreak: number;
	overallStreak: number;
	lastDailyClaimDate: string | null;
}

const CHEST_COLUMN_MAP = {
	silver_chest: 'silverChest',
	gold_chest: 'goldChest',
	boss_treasure_chest: 'bossTreasureChest',
	boss_golden_chest: 'bossGoldenChest',
} as const satisfies Record<ChestColumn, keyof typeof usersBag.$inferSelect>;

export class DailyRepository {
	async hasBag(executor: Executor, discordId: string): Promise<boolean> {
		const [row] = await executor
			.select()
			.from(usersBag)
			.where(eq(usersBag.discordId, discordId))
			.limit(1)
			.for('update');
		return !!row;
	}

	async getDailyState(executor: Executor, discordId: string): Promise<DailyState | null> {
		const [row] = await executor.select().from(users).where(eq(users.discordId, discordId)).limit(1);
		if (!row) return null;
		return {
			monthlyStreak: row.monthlyStreak,
			overallStreak: row.overallStreak,
			lastDailyClaimDate: row.lastDailyClaimDate,
		};
	}

	/** Applies the reward + optional milestone chest to users_bag; returns the new chest counts. */
	async applyReward(
		executor: Executor,
		discordId: string,
		params: { credux: number; shards: number; chestColumn: ChestColumn; milestoneColumn: ChestColumn | null },
	): Promise<{
		creduxAfter: number;
		beliefShardsAfter: number;
		chestCountAfter: number;
		milestoneChestCountAfter: number | null;
	}> {
		const [bag] = await executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
		if (!bag) throw new Error(DAILY_REPOSITORY_ERROR_TEXT.missingBag(discordId));
		const chestField = CHEST_COLUMN_MAP[params.chestColumn];
		const milestoneField = params.milestoneColumn ? CHEST_COLUMN_MAP[params.milestoneColumn] : null;

		const creduxAfter = bag.credux + params.credux;
		const beliefShardsAfter = bag.beliefShards + params.shards;
		const chestCountAfter = (bag[chestField] as number) + 1;
		const milestoneChestCountAfter = milestoneField ? (bag[milestoneField] as number) + 1 : null;

		// Chest column is picked at runtime from a small whitelisted map (never
		// user input), so a dynamic key here is safe; drizzle's `.set()` typing
		// can't express "one of these five known columns" so we cast the patch.
		const patch: Record<string, number> = {
			credux: creduxAfter,
			beliefShards: beliefShardsAfter,
			lifetimeCreduxEarned: bag.lifetimeCreduxEarned + params.credux,
			[chestField]: chestCountAfter,
		};
		if (milestoneField) patch[milestoneField] = milestoneChestCountAfter as number;

		await executor
			.update(usersBag)
			.set(patch as Partial<typeof usersBag.$inferInsert>)
			.where(eq(usersBag.discordId, discordId));

		return { creduxAfter, beliefShardsAfter, chestCountAfter, milestoneChestCountAfter };
	}

	async updateStreak(
		executor: Executor,
		discordId: string,
		params: { monthly: number; overall: number; todayKey: string },
	): Promise<void> {
		await executor
			.update(users)
			.set({ monthlyStreak: params.monthly, overallStreak: params.overall, lastDailyClaimDate: params.todayKey })
			.where(eq(users.discordId, discordId));
	}

	async logCurrencyChange(
		executor: Executor,
		discordId: string,
		action: string,
		field: 'credux' | 'belief_shards',
		before: number,
		after: number,
	): Promise<void> {
		if (field === 'credux') {
			await executor.insert(gameLogs).values({ discordId, action, previousCredux: before, updatedCredux: after });
		} else {
			await executor
				.insert(gameLogs)
				.values({ discordId, action, previousBeliefShards: before, updatedBeliefShards: after });
		}
	}

	async logChestChange(
		executor: Executor,
		discordId: string,
		action: string,
		itemType: string,
		before: number,
		after: number,
	): Promise<void> {
		await executor
			.insert(gameLogs)
			.values({ discordId, action, itemType, previousChestCount: before, updatedChestCount: after });
	}
}
