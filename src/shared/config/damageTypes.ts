/**
 * Phase 0 nền tảng cho trục khắc hệ (battle-upgrade-plan.md §Trục A).
 *
 * TRẠNG THÁI: **chưa bật trong damage formula** — đây chỉ là type + ma trận
 * cân bằng thuần config. `DamageCalculator`/`BattleAttack` CHƯA đọc các giá trị
 * này (xem feature flag `DAMAGE_TYPE_MATRIX_ENABLED`). Phase 1 mới wire vào
 * `mitigate()`; tới lúc đó mọi hệ số dưới đây là dead data có chủ đích, được
 * test chốt để không drift âm thầm.
 *
 * Nguyên tắc cân bằng: ma trận **zero-sum** — tổng mọi ô trong mỗi hàng và mỗi
 * cột xấp xỉ 1.0 (đối xứng khắc hệ), không có "hệ mạnh tuyệt đối". Mọi hệ số
 * nằm trong [MIN, MAX] để không có combo one-shot.
 */

export type DamageType = 'physical' | 'magical' | 'ranged' | 'holy' | 'shadow';
export type ArmorType = 'light' | 'medium' | 'heavy' | 'ethereal';

export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'magical', 'ranged', 'holy', 'shadow'];

export const ARMOR_TYPES: readonly ArmorType[] = ['light', 'medium', 'heavy', 'ethereal'];

/** Default combat identity — the neutral pair (physical/medium = 1.0), so test
 * combatants and unmapped content stay exactly on the old damage formula. */
export const DEFAULT_DAMAGE_TYPE: DamageType = 'physical';
export const DEFAULT_ARMOR_TYPE: ArmorType = 'medium';

/**
 * Feature flag — bật ở Phase 1 khi `mitigate()` đọc ma trận. Giữ false để
 * characterization snapshot hiện tại không đổi.
 */
export const DAMAGE_TYPE_MATRIX_ENABLED = true;

/** Crit severity default: 200% = the old fixed ×2 crit. */
export const DEFAULT_CRIT_DMG_PCT = 200;

/** Hệ số khắc hệ bị kẹp để tránh one-shot/immortal (anti-exploit). */
export const ARMOR_MULT_MIN = 0.8;
export const ARMOR_MULT_MAX = 1.2;

/**
 * `ARMOR_MULT[damage][armor]` = hệ số nhân lên damage khi damage type đánh vào
 * armor type. 1.0 = trung tính. >1 = khắc (bonus), <1 = bị kháng.
 *
 * Zero-sum chặt: **mọi hàng = 4.0 (avg 1.0)** và **mọi cột = 5.0 (avg 1.0)**:
 *
 * |            | light | medium | heavy | ethereal |
 * |------------|-------|--------|-------|----------|
 * | physical   | 1.1   | 1.0    | 0.8   | 1.1      |
 * | magical    | 0.9   | 1.1    | 1.2   | 0.8      |
 * | ranged     | 0.9   | 1.0    | 1.1   | 1.0      |
 * | holy       | 1.0   | 0.9    | 1.0   | 1.1      |
 * | shadow     | 1.1   | 1.0    | 0.9   | 1.0      |
 *
 * Đọc theo `ARMOR_MULT[damageType][armorType]`. Mỗi hàng có điểm mạnh lẫn
 * điểm yếu — không có "hệ vô đối".
 */
export const ARMOR_MULT: Readonly<Record<DamageType, Readonly<Record<ArmorType, number>>>> = {
	physical: { light: 1.1, medium: 1.0, heavy: 0.8, ethereal: 1.1 },
	magical: { light: 0.9, medium: 1.1, heavy: 1.2, ethereal: 0.8 },
	ranged: { light: 0.9, medium: 1.0, heavy: 1.1, ethereal: 1.0 },
	holy: { light: 1.0, medium: 0.9, heavy: 1.0, ethereal: 1.1 },
	shadow: { light: 1.1, medium: 1.0, heavy: 0.9, ethereal: 1.0 },
};

/**
 * Hệ số khắc hệ thuần (chưa wire). Kẹp về [ARMOR_MULT_MIN, ARMOR_MULT_MAX]
 * để dữ liệu seed lỗi không thể tạo one-shot. Trả 1.0 khi flag tắt để damage
 * formula hiện tại không đổi.
 */
export function armorMultiplier(damage: DamageType, armor: ArmorType, enabled = DAMAGE_TYPE_MATRIX_ENABLED): number {
	if (!enabled) return 1;
	const raw = ARMOR_MULT[damage]?.[armor] ?? 1;
	return Math.min(ARMOR_MULT_MAX, Math.max(ARMOR_MULT_MIN, raw));
}

/**
 * Combat identity theo class — derive-in-code (không migration, cùng pattern
 * với mob secondaries trong MonsterEncounterService). Mỗi class có damage
 * type (vũ khí/ma thuật đặc trưng) và armor type (độ "cứng" đặc trưng):
 * Mage là glass cannon (magical/light), Knight là tank (physical/heavy).
 * Khóa string thường để shared/config không phụ thuộc identity domain.
 */
export const CLASS_DAMAGE_TYPE: Readonly<Record<string, DamageType>> = {
	Swordsman: 'physical',
	Fighter: 'physical',
	Mage: 'magical',
	Knight: 'physical',
	Archer: 'ranged',
};

export const CLASS_ARMOR_TYPE: Readonly<Record<string, ArmorType>> = {
	Swordsman: 'medium',
	Fighter: 'medium',
	Mage: 'light',
	Knight: 'heavy',
	Archer: 'light',
};

export function damageTypeForClass(combatClass: string): DamageType {
	return CLASS_DAMAGE_TYPE[combatClass] ?? DEFAULT_DAMAGE_TYPE;
}

export function armorTypeForClass(combatClass: string): ArmorType {
	return CLASS_ARMOR_TYPE[combatClass] ?? DEFAULT_ARMOR_TYPE;
}
