/**
 * Deity blessing balance — M7 design defaults (không port số liệu từ bản gốc,
 * bản gốc không có trong repo; key bám theo blessing_key đã seed trong deity_roster).
 *
 * `scaling: 'scalable'` — hiệu ứng mạnh dần theo Sigil của deity trang bị:
 *   strength = 0.5 + 0.05 × sigils, chặn trên 1.0 (10 Sigil = 100%).
 * `scaling: 'binary'` — kích hoạt/không, không theo Sigil (strength = 1).
 * `value` là hệ số cơ sở của hiệu ứng (fraction), nhân với strength lúc build
 * decorator — xem DeityBlessingDecorator cho ý nghĩa từng key.
 */
export interface BlessingDef {
	scaling: 'scalable' | 'binary';
	value: number;
}

export const BLESSINGS = {
	guardian_light: { scaling: 'scalable', value: 0.04 },
	tailwind: { scaling: 'scalable', value: 0.25 },
	tidal_wrath: { scaling: 'scalable', value: 0.35 },
	moon_devourer: { scaling: 'scalable', value: 0.15 },
	lunar_veil: { scaling: 'scalable', value: 0.3 },
	solar_fury: { scaling: 'scalable', value: 0.06 },
	mountain_grace: { scaling: 'scalable', value: 0.35 },
	sky_sovereign: { scaling: 'binary', value: 1 },
} as const satisfies Record<string, BlessingDef>;

export type BlessingKey = keyof typeof BLESSINGS;

export const BLESSING_SCALING_CAP = 1.0;

/** Strength của một blessing theo Sigil đã seed — binary luôn trả 1. */
export function blessingStrength(scaling: string, sigils: number): number {
	if (scaling !== 'scalable') return 1;
	return Math.min(BLESSING_SCALING_CAP, 0.5 + 0.05 * Math.max(0, sigils));
}

/** Pantheon — trọng số stat theo slot (slot 1 full, slot 2/3 giảm dần). */
export const PANTHEON_SLOT_WEIGHT = [1, 0.5, 0.25] as const;

/** Resonance: 2 deity cùng mythology +10% phần deity, 3 cùng +20%. */
export function resonanceBonus(equippedMythologies: string[]): number {
	const counts = new Map<string, number>();
	for (const m of equippedMythologies) counts.set(m, (counts.get(m) ?? 0) + 1);
	const maxSame = Math.max(0, ...counts.values());
	if (maxSame >= 3) return 0.2;
	if (maxSame === 2) return 0.1;
	return 0;
}
