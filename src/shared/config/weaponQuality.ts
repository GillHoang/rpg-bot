/**
 * OwO-style weapon quality + economy config.
 *
 * Tier (Rare/Mythic/Legendary/Supreme) identifies the weapon *roster* row and
 * its base-stat band (see `GEAR_STATS` in chestLoot.ts). Quality identifies
 * the rolled grade of one concrete drop and multiplies its stats — the same
 * split OwO uses (weapon type vs. quality).
 */

export const WEAPON_QUALITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythical', 'Legendary', 'Fabled'] as const;

export type WeaponQuality = (typeof WEAPON_QUALITIES)[number];

/** ATK multiplier applied on top of currAtk (which already includes enhancement). */
export const WEAPON_QUALITY_ATK_MULT: Record<WeaponQuality, number> = {
	Common: 1.0,
	Uncommon: 1.1,
	Rare: 1.25,
	Epic: 1.45,
	Mythical: 1.7,
	Legendary: 2.0,
	Fabled: 2.5,
};

/** Flat CRIT% bonus stacked additively (still capped by CRIT_CAP_PCT at roll time). */
export const WEAPON_QUALITY_CRIT_BONUS: Record<WeaponQuality, number> = {
	Common: 0,
	Uncommon: 0.5,
	Rare: 1,
	Epic: 1.5,
	Mythical: 2,
	Legendary: 3,
	Fabled: 4,
};

export function isWeaponQuality(value: string): value is WeaponQuality {
	return (WEAPON_QUALITIES as readonly string[]).includes(value);
}

export function nextWeaponQuality(quality: WeaponQuality): WeaponQuality | null {
	const idx = WEAPON_QUALITIES.indexOf(quality);
	if (idx < 0 || idx >= WEAPON_QUALITIES.length - 1) return null;
	return WEAPON_QUALITIES[idx + 1]!;
}

/** Quality roll weights per roster tier. Higher tiers reach higher ceilings. */
const QUALITY_ROLL_WEIGHTS: Record<string, Partial<Record<WeaponQuality, number>>> = {
	Common: { Common: 100 },
	Rare: { Common: 45, Uncommon: 30, Rare: 18, Epic: 6, Mythical: 1 },
	Mythic: { Common: 25, Uncommon: 30, Rare: 25, Epic: 14, Mythical: 5, Legendary: 1 },
	Legendary: { Uncommon: 15, Rare: 30, Epic: 30, Mythical: 17, Legendary: 7, Fabled: 1 },
	Supreme: { Rare: 15, Epic: 30, Mythical: 30, Legendary: 20, Fabled: 5 },
	Divine: { Epic: 20, Mythical: 35, Legendary: 35, Fabled: 10 },
};

export function rollWeaponQuality(tier: string, rng: () => number): WeaponQuality {
	const weights = QUALITY_ROLL_WEIGHTS[tier] ?? QUALITY_ROLL_WEIGHTS.Rare!;
	const entries = Object.entries(weights) as Array<[WeaponQuality, number]>;
	const total = entries.reduce((sum, [, w]) => sum + w, 0);
	let roll = rng() * total;
	for (const [quality, weight] of entries) {
		roll -= weight;
		if (roll < 0) return quality;
	}
	return entries.at(-1)![0];
}

/** OwO-style weapon crate: spend credux, pull one random weapon. */
export const WEAPON_CRATE_COST = 150_000;

export const WEAPON_CRATE_TIER_WEIGHTS: Record<string, number> = {
	Rare: 60,
	Mythic: 28,
	Legendary: 10,
	Supreme: 2,
};

export function rollCrateTier(rng: () => number): string {
	const entries = Object.entries(WEAPON_CRATE_TIER_WEIGHTS);
	const total = entries.reduce((sum, [, w]) => sum + w, 0);
	let roll = rng() * total;
	for (const [tier, weight] of entries) {
		roll -= weight;
		if (roll < 0) return tier;
	}
	return entries.at(-1)![0];
}

export interface WeaponUpgradeCost {
	shards: number;
	credux: number;
}

/** Cost to upgrade FROM the key quality TO the next one. Fabled is maxed. */
export const WEAPON_UPGRADE_COSTS: Partial<Record<WeaponQuality, WeaponUpgradeCost>> = {
	Common: { shards: 50, credux: 10_000 },
	Uncommon: { shards: 150, credux: 50_000 },
	Rare: { shards: 400, credux: 200_000 },
	Epic: { shards: 1000, credux: 600_000 },
	Mythical: { shards: 2500, credux: 1_500_000 },
	Legendary: { shards: 6000, credux: 4_000_000 },
};

const DISMANTLE_SHARD_BASE: Record<string, number> = {
	Common: 5,
	Rare: 20,
	Mythic: 80,
	Legendary: 250,
	Supreme: 800,
	Divine: 1500,
};

/** OwO-style dismantle: spare weapons become weapon shards (+ a little credux). */
export function dismantleYield(tier: string, quality: WeaponQuality): { shards: number; credux: number } {
	const base = DISMANTLE_SHARD_BASE[tier] ?? 20;
	const qualityIdx = Math.max(0, WEAPON_QUALITIES.indexOf(quality));
	const shards = Math.floor(base * (1 + qualityIdx * 0.5));
	return { shards, credux: Math.floor(base * 250 * (1 + qualityIdx * 0.25)) };
}

/** OwO-style sell: straight credux for a weapon you don't dismantle. */
export function sellValue(tier: string, quality: WeaponQuality): number {
	const base = DISMANTLE_SHARD_BASE[tier] ?? 20;
	const qualityIdx = Math.max(0, WEAPON_QUALITIES.indexOf(quality));
	return Math.floor(base * 500 * (1 + qualityIdx * 0.25));
}
