import { SeasonService } from '../../meta/application/SeasonService.js';
import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import { defaultPersistence } from '../../../db/defaultPersistence.js';
import { PvpShopRepository } from '../infrastructure/PvpShopRepository.js';
import { PVP_SHOP_ITEMS, type PvpShopItem } from '../../../shared/config/pvpShop.js';
import type { Executor } from '../../../db/client.js';
import { COSMETIC_TIER_MIN_LEVEL } from '../../../shared/config/reputation.js';
import { CosmeticService } from '../../meta/application/CosmeticService.js';
import {
	PVP_BOUGHT_BAG,
	PVP_BOUGHT_COSMETIC,
	PVP_BOUGHT_TITLE,
	PVP_ALREADY_OWNED,
	PVP_INSUFFICIENT,
	PVP_ITEM_LINE,
	PVP_ITEM_NOT_FOUND,
	PVP_LIST_FOOTER,
	PVP_LIST_HEADER,
	PVP_NO_CHARACTER,
	PVP_NO_REGISTER,
	PVP_SEASON_LIMIT,
	PVP_TIER_LOCKED,
} from '../../../shared/ui/text/pvp.js';

export interface PvpShopDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		PvpShopRepository,
		'lockCharacter' | 'lockBag' | 'findCosmeticTier' | 'findPurchase' | 'incrementPurchase' | 'updateBag'
	>;
}

type LockedBag = Awaited<ReturnType<PvpShopRepository['lockBag']>>[number];

/**
 * /pvp shop — Valor Medals → item (M7). Cosmetic/title giới hạn 1 lần mỗi
 * season qua bảng pvp_shop_purchases; season được tạo lazily giống ranked.
 * Wording nằm ở src/shared/ui/text/pvp.ts.
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
			const restriction = await this.purchaseRestriction(
				tx,
				discordId,
				item,
				character.believerLevel,
				season.seasonId,
			);
			if (restriction) return restriction;
			return this.settlePurchase(tx, discordId, item, bag, season.seasonId);
		});
	}

	private async settlePurchase(
		tx: Executor,
		discordId: string,
		item: PvpShopItem,
		bag: LockedBag,
		seasonId: number,
	): Promise<string> {
		// Grant first: a duplicate must consume neither currency nor seasonal quota.
		if (item.kind.type === 'cosmetic') {
			const granted = await this.cosmetics.grantCosmeticInTx(tx, discordId, item.kind.cosmeticKey, 'shop');
			if (!granted) return PVP_ALREADY_OWNED;
		}
		if (item.kind.type === 'title') {
			const granted = await this.cosmetics.grantTitleInTx(tx, discordId, item.kind.titleCode);
			if (!granted) return PVP_ALREADY_OWNED;
		}
		if (item.kind.type !== 'bag' && item.limitPerSeason) {
			await this.queries.incrementPurchase(tx, {
				discordId,
				seasonId,
				itemKey: item.key,
				qty: 1,
			});
		}

		await this.queries.updateBag(tx, discordId, { valorMedals: bag.valorMedals - item.cost });
		if (item.kind.type === 'bag') {
			await this.queries.updateBag(tx, discordId, {
				[item.kind.field]: bag[item.kind.field] + item.kind.qty,
			});
			return PVP_BOUGHT_BAG(item.label, item.kind.qty);
		}
		return item.kind.type === 'cosmetic' ? PVP_BOUGHT_COSMETIC(item.label) : PVP_BOUGHT_TITLE(item.label);
	}

	private async purchaseRestriction(
		tx: Executor,
		discordId: string,
		item: PvpShopItem,
		believerLevel: number,
		seasonId: number,
	): Promise<string | undefined> {
		if (item.kind.type === 'cosmetic') {
			// Cosmetic tiers gate on believer level — same rule as /cosmetic equip.
			const [catalog] = await this.queries.findCosmeticTier(tx, item.kind.cosmeticKey);
			const minLevel = COSMETIC_TIER_MIN_LEVEL[catalog?.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL];
			if (minLevel != null && believerLevel < minLevel) return PVP_TIER_LOCKED(minLevel, believerLevel);
		}
		if (item.kind.type !== 'bag' && item.limitPerSeason) {
			const [purchase] = await this.queries.findPurchase(tx, discordId, seasonId, item.key);
			if ((purchase?.qty ?? 0) >= item.limitPerSeason) return PVP_SEASON_LIMIT(item.limitPerSeason);
		}
		return undefined;
	}
}

export type { PvpShopItem } from '../../../shared/config/pvpShop.js';
