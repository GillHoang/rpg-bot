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

export const DAMAGE_TYPES: readonly DamageType[] = [
	'physical',
	'magical',
	'ranged',
	'holy',
	'shadow',
];

export const ARMOR_TYPES: readonly ArmorType[] = ['light', 'medium', 'heavy', 'ethereal'];

/**
 * Feature flag — bật ở Phase 1 khi `mitigate()` đọc ma trận. Giữ false để
 * characterization snapshot hiện tại không đổi.
 */
export const DAMAGE_TYPE_MATRIX_ENABLED = false;

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
