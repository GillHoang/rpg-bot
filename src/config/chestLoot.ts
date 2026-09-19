import { choose, pick, rollChance } from '../utils/weightedRandom.js';
export { choose };
import { randInt } from './raidLoot.js';

export const CHESTS = {
	silver: {
		column: 'silverChest',
		label: 'Silver',
		credux: [10000, 50000],
		shards: [20, 50],
		runeChance: 15,
		runeTier: 'Rare',
		gearChance: 5,
		gearTiers: ['Rare'],
		essenceChance: 0,
		essence: 'mythicEssence',
		relicChance: 0,
		relic: null,
	},
	gold: {
		column: 'goldChest',
		label: 'Gold',
		credux: [50000, 200000],
		shards: [50, 150],
		runeChance: 40,
		runeTier: 'Mythic',
		gearChance: 15,
		gearTiers: ['Rare', 'Mythic'],
		essenceChance: 5,
		essence: 'mythicEssence',
		relicChance: 0,
		relic: null,
	},
	boss_treasure: {
		column: 'bossTreasureChest',
		label: 'Boss Treasure',
		credux: [100000, 300000],
		shards: [200, 500],
		runeChance: 60,
		runeTier: 'Mythic',
		gearChance: 30,
		gearTiers: ['Mythic'],
		essenceChance: 100,
		essence: 'mythicEssence',
		relicChance: 0,
		relic: null,
	},
	boss_golden: {
		column: 'bossGoldenChest',
		label: 'Boss Golden',
		credux: [300000, 600000],
		shards: [500, 1000],
		runeChance: 100,
		runeTier: 'Legendary',
		gearChance: 50,
		gearTiers: ['Legendary'],
		essenceChance: 100,
		essence: 'legendaryEssence',
		relicChance: 0,
		relic: null,
	},
	diamond: {
		column: 'diamondChest',
		label: 'Diamond',
		credux: [200000, 400000],
		shards: [300, 600],
		runeChance: 100,
		runeTier: 'Legendary',
		gearChance: 40,
		gearTiers: ['Legendary'],
		essenceChance: 50,
		essence: 'legendaryEssence',
		relicChance: 25,
		relic: 'sacredRelics',
	},
	genesis: {
		column: 'genesisChest',
		label: 'Genesis',
		credux: [500000, 1000000],
		shards: [800, 1500],
		runeChance: 100,
		runeTier: 'Supreme',
		gearChance: 50,
		gearTiers: ['Supreme'],
		essenceChance: 100,
		essence: 'supremeEssence',
		relicChance: 100,
		relic: 'supremeRelics',
	},
} as const;
export type ChestKey = keyof typeof CHESTS;

/**
 * Rune-bag drop per chest (M7): rương càng hiếm càng nghiêng túi lớn.
 * Weighted single pick mỗi lần mở — 0% được lọc bỏ trước khi pick.
 */
export const RUNE_BAG_DROPS: Record<
	ChestKey,
	{ lesserRuneBag: number; greaterRuneBag: number; divineRuneBag: number }
> = {
	silver: { lesserRuneBag: 0, greaterRuneBag: 0, divineRuneBag: 0 },
	gold: { lesserRuneBag: 8, greaterRuneBag: 0, divineRuneBag: 0 },
	boss_treasure: { lesserRuneBag: 20, greaterRuneBag: 8, divineRuneBag: 0 },
	boss_golden: { lesserRuneBag: 0, greaterRuneBag: 30, divineRuneBag: 12 },
	diamond: { lesserRuneBag: 0, greaterRuneBag: 50, divineRuneBag: 25 },
	genesis: { lesserRuneBag: 0, greaterRuneBag: 0, divineRuneBag: 100 },
};

export function rollRuneBagField(
	key: ChestKey,
	rng: () => number,
): 'lesserRuneBag' | 'greaterRuneBag' | 'divineRuneBag' | null {
	const entries = Object.entries(RUNE_BAG_DROPS[key]).filter(([, weight]) => weight > 0);
	if (!entries.length) return null;
	return pick(
		entries.map(([original, weight]) => ({
			original: original as 'lesserRuneBag' | 'greaterRuneBag' | 'divineRuneBag',
			weight,
		})),
		{ next: rng },
	);
}

export function chance(percent: number, rng: () => number): boolean {
	return rollChance(percent / 100, rng);
}
export function rollChest(key: ChestKey, rng: () => number) {
	const table = CHESTS[key];
	return {
		credux: randInt(rng, table.credux),
		shards: randInt(rng, table.shards),
		runeTier: chance(table.runeChance, rng) ? table.runeTier : null,
		gearTier: chance(table.gearChance, rng) ? choose(table.gearTiers, rng) : null,
		essence: chance(table.essenceChance, rng) ? table.essence : null,
		runeBag: rollRuneBagField(key, rng),
		relic: chance(table.relicChance, rng) ? table.relic : null,
	};
}
// New balance values: roster rows contain names/passives, not base gear stats.
export const GEAR_STATS = {
	Rare: { atk: [80, 120], hp: [400, 600], def: [40, 60], crit: [2, 4] },
	Mythic: { atk: [160, 240], hp: [800, 1200], def: [80, 120], crit: [4, 6] },
	Legendary: { atk: [320, 480], hp: [1600, 2400], def: [160, 240], crit: [6, 8] },
	Supreme: { atk: [640, 960], hp: [3200, 4800], def: [320, 480], crit: [8, 10] },
} as const;
