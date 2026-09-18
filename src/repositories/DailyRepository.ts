import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { users, usersBag, gameLogs } from '../db/schema.js';
import type { ChestColumn } from '../domain/economy/DailyRewardTable.js';

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
	hasBag(executor: Executor, discordId: string): boolean {
		return !!executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).get();
	}

	getDailyState(executor: Executor, discordId: string): DailyState | null {
		const row = executor.select().from(users).where(eq(users.discordId, discordId)).get();
		if (!row) return null;
		return {
			monthlyStreak: row.monthlyStreak,
			overallStreak: row.overallStreak,
			lastDailyClaimDate: row.lastDailyClaimDate,
		};
	}

	/** Applies the reward + optional milestone chest to users_bag; returns the new chest counts. */
	applyReward(
		executor: Executor,
		discordId: string,
		params: { credux: number; shards: number; chestColumn: ChestColumn; milestoneColumn: ChestColumn | null },
	): {
		creduxAfter: number;
		beliefShardsAfter: number;
		chestCountAfter: number;
		milestoneChestCountAfter: number | null;
	} {
		const bag = executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).get()!;
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

		executor
			.update(usersBag)
			.set(patch as Partial<typeof usersBag.$inferInsert>)
			.where(eq(usersBag.discordId, discordId))
			.run();

		return { creduxAfter, beliefShardsAfter, chestCountAfter, milestoneChestCountAfter };
	}

	updateStreak(
		executor: Executor,
		discordId: string,
		params: { monthly: number; overall: number; todayKey: string },
	): void {
		executor
			.update(users)
			.set({ monthlyStreak: params.monthly, overallStreak: params.overall, lastDailyClaimDate: params.todayKey })
			.where(eq(users.discordId, discordId))
			.run();
	}

	logCurrencyChange(
		executor: Executor,
		discordId: string,
		action: string,
		field: 'credux' | 'belief_shards',
		before: number,
		after: number,
	): void {
		if (field === 'credux') {
			executor.insert(gameLogs).values({ discordId, action, previousCredux: before, updatedCredux: after }).run();
		} else {
			executor
				.insert(gameLogs)
				.values({ discordId, action, previousBeliefShards: before, updatedBeliefShards: after })
				.run();
		}
	}

	logChestChange(
		executor: Executor,
		discordId: string,
		action: string,
		itemType: string,
		before: number,
		after: number,
	): void {
		executor
			.insert(gameLogs)
			.values({ discordId, action, itemType, previousChestCount: before, updatedChestCount: after })
			.run();
	}
}
