import { RUNES_TEXT } from '../../../shared/ui/text/catalog/runes.js';
/**
 * SEED DATA — socket_unlock_cost + essence_bag_def
 * ---------------------------------------------------------------------------
 * Bảng giá mở socket theo tier gear, và định nghĩa túi essence (chưa có
 * service port — seed sẵn cho Milestone rune-economy).
 *
 * essenceTier hợp lệ: epic | mythic | legendary | supreme
 */

export interface SocketUnlockCostSeed {
	tier: 'Rare' | 'Mythic' | 'Legendary' | 'Supreme' | 'Divine';
	slotIndex: number; // 2..4 (slot đầu tiên free)
	essenceTier: 'epic' | 'mythic' | 'legendary' | 'supreme';
	essenceCost: number;
	creduxCost: number;
}

export const SOCKET_UNLOCK_COST_SEED: SocketUnlockCostSeed[] = [
	{ tier: 'Rare', slotIndex: 2, essenceTier: 'epic', essenceCost: 5, creduxCost: 5000 },
	{ tier: 'Rare', slotIndex: 3, essenceTier: 'epic', essenceCost: 10, creduxCost: 15000 },
	{ tier: 'Mythic', slotIndex: 2, essenceTier: 'mythic', essenceCost: 5, creduxCost: 10000 },
	{ tier: 'Mythic', slotIndex: 3, essenceTier: 'mythic', essenceCost: 10, creduxCost: 25000 },
	{ tier: 'Legendary', slotIndex: 2, essenceTier: 'legendary', essenceCost: 3, creduxCost: 20000 },
	{ tier: 'Legendary', slotIndex: 3, essenceTier: 'legendary', essenceCost: 6, creduxCost: 50000 },
	{ tier: 'Supreme', slotIndex: 2, essenceTier: 'supreme', essenceCost: 2, creduxCost: 50000 },
	{ tier: 'Supreme', slotIndex: 3, essenceTier: 'supreme', essenceCost: 4, creduxCost: 100000 },
];

export interface EssenceBagDefSeed {
	bagKey: string;
	openCommand: string;
	essenceTier: 'epic' | 'mythic' | 'legendary' | 'supreme';
	essenceCost: number;
	creduxCost: number;
	runePool: string[]; // tên rune trong rune_roster
}

export const ESSENCE_BAG_DEF_SEED: EssenceBagDefSeed[] = [
	{
		bagKey: 'lb',
		openCommand: 'legendary_bag',
		essenceTier: 'legendary',
		essenceCost: 15,
		creduxCost: 20000,
		runePool: [RUNES_TEXT['10'].name, RUNES_TEXT['11'].name],
	},
	{
		bagKey: 'gb',
		openCommand: 'grand_bag',
		essenceTier: 'mythic',
		essenceCost: 30,
		creduxCost: 30000,
		runePool: [
			RUNES_TEXT['5'].name,
			RUNES_TEXT['6'].name,
			RUNES_TEXT['7'].name,
			RUNES_TEXT['8'].name,
			RUNES_TEXT['9'].name,
			RUNES_TEXT['10'].name,
			RUNES_TEXT['11'].name,
			RUNES_TEXT['21'].name,
		],
	},
	{
		bagKey: 'db',
		openCommand: 'divine_bag',
		essenceTier: 'supreme',
		essenceCost: 10,
		creduxCost: 50000,
		runePool: [RUNES_TEXT['11'].name, RUNES_TEXT['10'].name],
	},
];
