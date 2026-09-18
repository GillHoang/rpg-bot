import { choose, rollChance } from '../utils/weightedRandom.js';
export { choose } from '../utils/weightedRandom.js';
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
	},
} as const;
export type ChestKey = keyof typeof CHESTS;
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
	};
}
// New balance values: roster rows contain names/passives, not base gear stats.
export const GEAR_STATS = {
	Rare: { atk: [80, 120], hp: [400, 600], def: [40, 60], crit: [2, 4] },
	Mythic: { atk: [160, 240], hp: [800, 1200], def: [80, 120], crit: [4, 6] },
	Legendary: { atk: [320, 480], hp: [1600, 2400], def: [160, 240], crit: [6, 8] },
} as const;
