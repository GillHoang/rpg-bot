/**
 * Raid loot constants — ported from config/raidLoot.js, **regular mobs
 * only**. The elite branch (20% spawn chance, higher rewards, gold
 * chest) is deferred: MonsterRepository currently only ever picks
 * mob_type='regular' (see its own doc comment), so elite loot has
 * nothing to attach to yet.
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

export function randInt(rng: () => number, [min, max]: readonly [number, number]): number {
	return min + Math.floor(rng() * (max - min + 1));
}

export function rollRaidChest(rng: () => number, chestChance: number): boolean {
	return rng() < chestChance;
}
