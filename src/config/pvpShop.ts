/**
 * PVP shop — tiêu Valor Medals kiếm từ weekly quest + ranked weekly claim.
 * M7 design defaults (không port từ bản gốc). Cosmetic/title giới hạn mua
 * 1 lần mỗi season (theo dõi qua pvp_shop_purchases).
 */
export interface PvpShopItem {
	key: string;
	label: string;
	cost: number;
	kind:
		| { type: 'bag'; field: 'changeClass' | 'diamondChest'; qty: number }
		| { type: 'cosmetic'; cosmeticKey: string }
		| { type: 'title'; titleCode: string };
	/** Cosmetic/title: số lần tối đa mỗi season. */
	limitPerSeason?: number;
}

export const PVP_SHOP_ITEMS: readonly PvpShopItem[] = [
	{
		key: 'change_class',
		label: 'Change-Class Token (đổi class)',
		cost: 120,
		kind: { type: 'bag', field: 'changeClass', qty: 1 },
	},
	{
		key: 'diamond_chest',
		label: 'Diamond Chest',
		cost: 60,
		kind: { type: 'bag', field: 'diamondChest', qty: 1 },
	},
	{
		key: 'frame_gold',
		label: 'Cosmetic — Golden Frame (tier Chosen)',
		cost: 40,
		kind: { type: 'cosmetic', cosmeticKey: 'frame_gold' },
		limitPerSeason: 1,
	},
	{
		key: 'frame_eternal',
		label: 'Cosmetic — Eternal Frame (tier Eternal)',
		cost: 90,
		kind: { type: 'cosmetic', cosmeticKey: 'frame_eternal' },
		limitPerSeason: 1,
	},
	{
		key: 'title_champion',
		label: 'Title — Arena Champion',
		cost: 80,
		kind: { type: 'title', titleCode: 'rank_champion' },
		limitPerSeason: 1,
	},
	{
		key: 'banner_crimson',
		label: 'Cosmetic — Crimson Battle Banner (tier Chosen)',
		cost: 50,
		kind: { type: 'cosmetic', cosmeticKey: 'banner_crimson' },
		limitPerSeason: 1,
	},
	{
		key: 'summon_circle_gold',
		label: 'Cosmetic — Golden Summon Circle (tier Chosen)',
		cost: 70,
		kind: { type: 'cosmetic', cosmeticKey: 'summon_circle_gold' },
		limitPerSeason: 1,
	},
	{
		key: 'title_legend',
		label: 'Title — Arena Legend',
		cost: 150,
		kind: { type: 'title', titleCode: 'arena_legend' },
		limitPerSeason: 1,
	},
];
