/**
 * Phase 3 gear sets (battle-upgrade-plan.md §Trục C).
 *
 * Mỗi tier có đủ 3 set (gán round-robin trong seed) nên người chơi luôn có
 * lựa chọn thật trong cùng tier: bloodfang (công) · stoneward (thủ) ·
 * swiftwind (tốc). Chỉ có bonus 2 món (weapon + armor cùng set) vì đó là
 * toàn bộ gear slot. Bonus dùng cùng từ vựng statMods của rune để cộng
 * dồn một lần trong StatAssembly (không compound).
 */

export interface GearSetBonus {
	atkPct?: number;
	hpPct?: number;
	defPct?: number;
	/** Crit points — 0.02 = +2 crit (cùng đơn vị với rune precision). */
	critPts?: number;
	spdPct?: number;
	accPts?: number;
}

export interface GearSetDef {
	key: string;
	name: string;
	/** Bonus khi weapon + armor cùng set. */
	bonus2pc: GearSetBonus;
}

export const GEAR_SETS: Readonly<Record<string, GearSetDef>> = {
	bloodfang: {
		key: 'bloodfang',
		name: 'Bloodfang',
		bonus2pc: { atkPct: 0.08 },
	},
	stoneward: {
		key: 'stoneward',
		name: 'Stoneward',
		bonus2pc: { hpPct: 0.08, defPct: 0.08 },
	},
	swiftwind: {
		key: 'swiftwind',
		name: 'Swiftwind',
		bonus2pc: { spdPct: 0.08, critPts: 0.02 },
	},
};

export function gearSetBonusFor(setKey: string | null | undefined): GearSetBonus | null {
	if (!setKey) return null;
	return GEAR_SETS[setKey]?.bonus2pc ?? null;
}

/** Shared stat-mod shape with rune statMods (summed once, applied once). */
export interface GearSetMods {
	atkPct: number;
	hpPct: number;
	defPct: number;
	critPts: number;
	spdPct: number;
	accPts: number;
}

/**
 * Applies the 2-piece set bonus when weapon + armor share a set key.
 * Returns the matched set key, or null (starter gear, mismatched, unknown).
 */
export function applyGearSetBonus(
	mods: GearSetMods,
	weaponSet: string | null | undefined,
	armorSet: string | null | undefined,
): string | null {
	if (!weaponSet || weaponSet !== armorSet) return null;
	const bonus = gearSetBonusFor(weaponSet);
	if (!bonus) return null;
	mods.atkPct += bonus.atkPct ?? 0;
	mods.hpPct += bonus.hpPct ?? 0;
	mods.defPct += bonus.defPct ?? 0;
	mods.critPts += bonus.critPts ?? 0;
	mods.spdPct += bonus.spdPct ?? 0;
	mods.accPts += bonus.accPts ?? 0;
	return weaponSet;
}
