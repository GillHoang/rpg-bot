import { SeasonService } from './SeasonService.js';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { PvpShopRepository } from '../repositories/PvpShopRepository.js';
import { PVP_SHOP_ITEMS } from '../config/pvpShop.js';
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

export interface PvpShopDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		PvpShopRepository,
		'lockCharacter' | 'lockBag' | 'findCosmeticTier' | 'findPurchase' | 'incrementPurchase' | 'updateBag'
	>;
}

/**
 * /pvp shop — Valor Medals → item (M7). Cosmetic/title giới hạn 1 lần mỗi
 * season qua bảng pvp_shop_purchases; season được tạo lazily giống ranked.
 * Wording nằm ở src/text/pvp.ts.
 */

export class PvpShopService {
	private readonly seasons = new SeasonService();
	private readonly persistence: PersistenceContext;
	private readonly cosmetics: Pick<CosmeticService, 'grantCosmeticInTx' | 'grantTitleInTx'>;
	private readonly queries: Pick<
		PvpShopRepository,
		'lockCharacter' | 'lockBag' | 'findCosmeticTier' | 'findPurchase' | 'incrementPurchase' | 'updateBag'
	>;

	constructor(
		cosmetics?: Pick<CosmeticService, 'grantCosmeticInTx' | 'grantTitleInTx'>,
		options: PvpShopDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.cosmetics = cosmetics ?? new CosmeticService({ persistence: this.persistence });
		this.queries = options.queries ?? new PvpShopRepository();
	}

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
		return this.persistence.unitOfWork.run(async (tx) => {
			const [bag] = await this.queries.lockBag(tx, discordId);
			const [character] = await this.queries.lockCharacter(tx, discordId);
			if (!character) return PVP_NO_CHARACTER;
			if (!bag) return PVP_NO_REGISTER;
			if (bag.valorMedals < item.cost) return PVP_INSUFFICIENT(item.cost, bag.valorMedals);

			const season = await this.seasons.ensureActive(tx);
			if (item.kind.type === 'cosmetic') {
				// Cosmetic tiers gate on believer level — same rule as /cosmetic equip.
				const [catalog] = await this.queries.findCosmeticTier(tx, item.kind.cosmeticKey);
				const minLevel = COSMETIC_TIER_MIN_LEVEL[catalog?.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL];
				if (minLevel != null && character.believerLevel < minLevel)
					return PVP_TIER_LOCKED(minLevel, character.believerLevel);
			}
			if (item.kind.type !== 'bag' && item.limitPerSeason) {
				const [purchase] = await this.queries.findPurchase(tx, discordId, season.seasonId, item.key);
				if ((purchase?.qty ?? 0) >= item.limitPerSeason) return PVP_SEASON_LIMIT(item.limitPerSeason);
				await this.queries.incrementPurchase(tx, {
					discordId,
					seasonId: season.seasonId,
					itemKey: item.key,
					qty: 1,
				});
			}

			await this.queries.updateBag(tx, discordId, { valorMedals: bag.valorMedals - item.cost });

			switch (item.kind.type) {
				case 'bag':
					await this.queries.updateBag(tx, discordId, {
						[item.kind.field]: bag[item.kind.field] + item.kind.qty,
					});
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
}

export type { PvpShopItem } from '../config/pvpShop.js';
