import type { Executor } from '../db/client.js';
import { and, eq, sql } from 'drizzle-orm';
import { cosmeticCatalog, pvpShopPurchases, seasons, usersBag, userCharacter } from '../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class PvpShopRepository {
	async lockCharacter(tx: Executor, discordId: string) {
		return tx.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1).for('update');
	}

	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');
	}

	async findCosmeticTier(tx: Executor, cosmeticKey: string) {
		return tx
			.select({ tier: cosmeticCatalog.tier })
			.from(cosmeticCatalog)
			.where(eq(cosmeticCatalog.cosmeticKey, cosmeticKey))
			.limit(1);
	}

	async findPurchase(tx: Executor, discordId: string, seasonId: number, itemKey: string) {
		return tx
			.select()
			.from(pvpShopPurchases)
			.where(
				and(
					eq(pvpShopPurchases.discordId, discordId),
					eq(pvpShopPurchases.seasonId, seasonId),
					eq(pvpShopPurchases.itemKey, itemKey),
				),
			)
			.limit(1);
	}

	async incrementPurchase(tx: Executor, values: typeof pvpShopPurchases.$inferInsert) {
		return tx
			.insert(pvpShopPurchases)
			.values(values)
			.onConflictDoUpdate({
				target: [pvpShopPurchases.discordId, pvpShopPurchases.seasonId, pvpShopPurchases.itemKey],
				set: { qty: sql`${pvpShopPurchases.qty} + 1` },
			});
	}

	async updateBag(tx: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return tx.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}

	async findActiveSeason(tx: Executor) {
		return tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
	}

	async countSeasons(tx: Executor) {
		return tx.select({ count: sql<number>`count(*)::int` }).from(seasons);
	}

	async createSeason(tx: Executor, values: typeof seasons.$inferInsert) {
		return tx.insert(seasons).values(values).returning();
	}
}
