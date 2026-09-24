import { COSMETICS_TEXT } from '../../../shared/ui/text/catalog/cosmetics.js';
/**
 * SEED DATA — cosmetic_catalog (M7, số liệu mặc định mới).
 * Category: profile | battle | battle_result | summon
 * Tier: believer (mặc định) | chosen (believer level 5) | eternal (level 10)
 * isBase: tự grant + auto-equip khi /create. Các item shop mua bằng Valor
 * Medals qua /pvp shop.
 */
export interface CosmeticSeed {
	cosmeticKey: string;
	category: 'profile' | 'battle' | 'battle_result' | 'summon';
	tier: 'believer' | 'chosen' | 'eternal';
	displayName: string;
	isBase: boolean;
}

export const COSMETIC_SEED: CosmeticSeed[] = [
	{
		cosmeticKey: 'base_profile',
		category: 'profile',
		tier: 'believer',
		displayName: COSMETICS_TEXT['base_profile'].displayName,
		isBase: true,
	},
	{
		cosmeticKey: 'base_battle',
		category: 'battle',
		tier: 'believer',
		displayName: COSMETICS_TEXT['base_battle'].displayName,
		isBase: true,
	},
	{
		cosmeticKey: 'frame_gold',
		category: 'profile',
		tier: 'chosen',
		displayName: COSMETICS_TEXT['frame_gold'].displayName,
		isBase: false,
	},
	{
		cosmeticKey: 'frame_eternal',
		category: 'profile',
		tier: 'eternal',
		displayName: COSMETICS_TEXT['frame_eternal'].displayName,
		isBase: false,
	},
	{
		cosmeticKey: 'frame_silver',
		category: 'profile',
		tier: 'believer',
		displayName: COSMETICS_TEXT['frame_silver'].displayName,
		isBase: false,
	},
	{
		cosmeticKey: 'banner_crimson',
		category: 'battle',
		tier: 'chosen',
		displayName: COSMETICS_TEXT['banner_crimson'].displayName,
		isBase: false,
	},
	{
		cosmeticKey: 'summon_circle_gold',
		category: 'summon',
		tier: 'chosen',
		displayName: COSMETICS_TEXT['summon_circle_gold'].displayName,
		isBase: false,
	},
	{
		cosmeticKey: 'banner_eternal',
		category: 'battle',
		tier: 'eternal',
		displayName: COSMETICS_TEXT['banner_eternal'].displayName,
		isBase: false,
	},
];
