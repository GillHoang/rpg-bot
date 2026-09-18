import { rollChance } from '../utils/weightedRandom.js';
/**
 * Regular raid loot preserves the ported values. Elite and boss values
 * below are new gameplay balance defaults documented in docs/gameplay-implementation.md.
 */
export const RAID_LOOT_REGULAR = {
	win: {
		creduxRange: [500, 1000] as const,
		expRange: [200, 300] as const,
		shardsRange: [5, 10] as const,
		chestChance: 0.2,
		chestColumn: 'silver_chest' as const,
	},
	loss: { exp: 50 },
};

// New gameplay balance values, configurable independently of regular raids.
export const RAID_LOOT_ELITE = {
	win: {
		creduxRange: [2500, 5000] as const,
		expRange: [500, 750] as const,
		shardsRange: [20, 30] as const,
		chestChance: 0.35,
	},
	loss: { exp: 100 },
};
export const RAID_LOOT_BOSS = {
	win: {
		creduxRange: [25000, 50000] as const,
		expRange: [1500, 2500] as const,
		shardsRange: [100, 200] as const,
		chestChance: 1,
	},
	loss: { exp: 150 },
};
export const BOSS_ENTRY = { minLevel: 10, credux: 10000, eclipseDamageBonus: 50, gearChance: 0.3 } as const;

export function randInt(rng: () => number, [min, max]: readonly [number, number]): number {
	return min + Math.floor(rng() * (max - min + 1));
}

export function rollRaidChest(rng: () => number, chestChance: number): boolean {
	return rollChance(chestChance, rng);
}
