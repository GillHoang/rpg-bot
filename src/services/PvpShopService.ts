import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pvpShopPurchases, seasons, usersBag, userCharacter } from '../db/schema.js';
import { PVP_SHOP_ITEMS, type PvpShopItem } from '../config/pvpShop.js';
import { CosmeticService } from './CosmeticService.js';

/**
 * /pvp shop — Valor Medals → item (M7). Cosmetic/title giới hạn 1 lần mỗi
 * season qua bảng pvp_shop_purchases; season được tạo lazily giống ranked.
 */
export class PvpShopService {
	constructor(private readonly cosmetics = new CosmeticService()) {}

	list(): string {
		return (
			'⚔️ **PVP Shop** (Valor Medals từ weekly quest + /ranked claim)\n' +
			PVP_SHOP_ITEMS.map((item) => `**${item.key}** — ${item.label}: ${item.cost} valor`).join('\n') +
			'\n/pvp buy item:<key> để mua.'
		);
	}

	async buy(discordId: string, itemKey: string): Promise<string> {
		const item = PVP_SHOP_ITEMS.find((i) => i.key === itemKey);
		if (!item) return 'Item không tồn tại.';
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1)
				.for('update');
			if (!character) return 'Dùng /create trước.';
			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) return 'Dùng /register trước.';
			if (bag.valorMedals < item.cost) return `Cần ${item.cost} Valor Medals (đang có ${bag.valorMedals}).`;

			const season = await this.ensureActiveSeason(tx);
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
				if ((purchase?.qty ?? 0) >= item.limitPerSeason)
					return `Đã mua tối đa (${item.limitPerSeason}/season) item này.`;
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
					return `Đã mua ${item.label}. Bag: +${item.kind.qty}.`;
				case 'cosmetic': {
					await this.cosmetics.grantCosmeticInTx(tx, discordId, item.kind.cosmeticKey, 'shop');
					return `Đã mua ${item.label}. /cosmetic equip để trang bị.`;
				}
				case 'title': {
					await this.cosmetics.grantTitleInTx(tx, discordId, item.kind.titleCode);
					return `Đã mua ${item.label}. /title equip để đeo.`;
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
