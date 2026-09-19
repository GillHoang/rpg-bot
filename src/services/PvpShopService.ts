import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cosmeticCatalog, pvpShopPurchases, seasons, usersBag, userCharacter } from '../db/schema.js';
import { PVP_SHOP_ITEMS, type PvpShopItem } from '../config/pvpShop.js';
import { COSMETIC_TIER_MIN_LEVEL } from '../config/reputation.js';
import { CosmeticService } from './CosmeticService.js';
import {
	PVP_BOUGHT_BAG,
	PVP_BOUGHT_COSMETIC,
	PVP_BOUGHT_TITLE,
	PVP_INSUFFICIENT,
	PVP_ITEM_LINE,
	PVP_ITEM_NOT_FOUND,
	PVP_LIST_FOOTER,
	PVP_LIST_HEADER,
	PVP_NO_CHARACTER,
	PVP_NO_REGISTER,
	PVP_SEASON_LIMIT,
	PVP_TIER_LOCKED,
} from '../text/pvp.js';

/**
 * /pvp shop — Valor Medals → item (M7). Cosmetic/title giới hạn 1 lần mỗi
 * season qua bảng pvp_shop_purchases; season được tạo lazily giống ranked.
 * Wording nằm ở src/text/pvp.ts.
 */
export class PvpShopService {
	constructor(private readonly cosmetics = new CosmeticService()) {}

	list(): string {
		return (
			PVP_LIST_HEADER +
			'\n' +
			PVP_SHOP_ITEMS.map((item) => PVP_ITEM_LINE(item.key, item.label, item.cost)).join('\n') +
			PVP_LIST_FOOTER
		);
	}

	async buy(discordId: string, itemKey: string): Promise<string> {
		const item = PVP_SHOP_ITEMS.find((i) => i.key === itemKey);
		if (!item) return PVP_ITEM_NOT_FOUND;
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1)
				.for('update');
			if (!character) return PVP_NO_CHARACTER;
			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) return PVP_NO_REGISTER;
			if (bag.valorMedals < item.cost) return PVP_INSUFFICIENT(item.cost, bag.valorMedals);

			const season = await this.ensureActiveSeason(tx);
			if (item.kind.type === 'cosmetic') {
				// Cosmetic tiers gate on believer level — same rule as /cosmetic equip.
				const [catalog] = await tx
					.select({ tier: cosmeticCatalog.tier })
					.from(cosmeticCatalog)
					.where(eq(cosmeticCatalog.cosmeticKey, item.kind.cosmeticKey))
					.limit(1);
				const minLevel = COSMETIC_TIER_MIN_LEVEL[catalog?.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL];
				if (minLevel != null && character.believerLevel < minLevel)
					return PVP_TIER_LOCKED(minLevel, character.believerLevel);
			}
			if (item.kind.type !== 'bag' && item.limitPerSeason) {
				const [purchase] = await tx
					.select()
					.from(pvpShopPurchases)
					.where(
						and(
							eq(pvpShopPurchases.discordId, discordId),
							eq(pvpShopPurchases.seasonId, season.seasonId),
							eq(pvpShopPurchases.itemKey, item.key),
						),
					)
					.limit(1);
				if ((purchase?.qty ?? 0) >= item.limitPerSeason) return PVP_SEASON_LIMIT(item.limitPerSeason);
				await tx
					.insert(pvpShopPurchases)
					.values({ discordId, seasonId: season.seasonId, itemKey: item.key, qty: 1 })
					.onConflictDoUpdate({
						target: [pvpShopPurchases.discordId, pvpShopPurchases.seasonId, pvpShopPurchases.itemKey],
						set: { qty: sql`${pvpShopPurchases.qty} + 1` },
					});
			}

			await tx
				.update(usersBag)
				.set({ valorMedals: bag.valorMedals - item.cost })
				.where(eq(usersBag.discordId, discordId));

			switch (item.kind.type) {
				case 'bag':
					await tx
						.update(usersBag)
						.set({ [item.kind.field]: bag[item.kind.field] + item.kind.qty })
						.where(eq(usersBag.discordId, discordId));
					return PVP_BOUGHT_BAG(item.label, item.kind.qty);
				case 'cosmetic': {
					await this.cosmetics.grantCosmeticInTx(tx, discordId, item.kind.cosmeticKey, 'shop');
					return PVP_BOUGHT_COSMETIC(item.label);
				}
				case 'title': {
					await this.cosmetics.grantTitleInTx(tx, discordId, item.kind.titleCode);
					return PVP_BOUGHT_TITLE(item.label);
				}
			}
		});
	}

	private async ensureActiveSeason(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
		const [active] = await tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
		if (active) return active;
		const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(seasons);
		const [created] = await tx
			.insert(seasons)
			.values({
				name: `Season ${count + 1}`,
				startsAt: new Date(),
				endsAt: new Date(Date.now() + 30 * 86_400_000),
				isActive: true,
			})
			.returning();
		return created;
	}
}

export type { PvpShopItem };
