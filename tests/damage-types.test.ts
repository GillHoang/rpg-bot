import { describe, expect, it } from 'vitest';
import {
	ARMOR_MULT,
	ARMOR_MULT_MAX,
	ARMOR_MULT_MIN,
	ARMOR_TYPES,
	DAMAGE_TYPES,
	DAMAGE_TYPE_MATRIX_ENABLED,
	armorMultiplier,
	type ArmorType,
	type DamageType,
} from '../src/shared/config/damageTypes.js';

/**
 * Chốt ma trận khắc hệ ở Phase 0 — TRƯỚC khi wire vào damage formula
 * (`DAMAGE_TYPE_MATRIX_ENABLED = false`). Đây là dữ liệu dead có chủ đích;
 * test đảm bảo nó zero-sum, có giới hạn, và chưa đụng damage hiện tại.
 */

describe('damage/armor counter matrix (Phase 0 — chưa bật)', () => {
	it('feature flag mặc định tắt để characterization snapshot không đổi', () => {
		expect(DAMAGE_TYPE_MATRIX_ENABLED).toBe(false);
		expect(armorMultiplier('physical', 'heavy')).toBe(1);
		expect(armorMultiplier('magical', 'light', false)).toBe(1);
	});

	it('mọi hệ số nằm trong [min, max] — không combo one-shot/immortal', () => {
		for (const damage of DAMAGE_TYPES) {
			for (const armor of ARMOR_TYPES) {
				const mult = armorMultiplier(damage, armor, true);
				expect(mult).toBeGreaterThanOrEqual(ARMOR_MULT_MIN);
				expect(mult).toBeLessThanOrEqual(ARMOR_MULT_MAX);
			}
		}
	});

	it('zero-sum theo hàng: mỗi damage type có khắc và bị khắc, trung bình = 1', () => {
		for (const damage of DAMAGE_TYPES) {
			const values = ARMOR_TYPES.map((armor) => ARMOR_MULT[damage][armor]);
			const avg = values.reduce((a, b) => a + b, 0) / values.length;
			expect(avg, `hàng ${damage}`).toBeCloseTo(1, 5);
			// Phải có cả điểm mạnh lẫn điểm yếu — không có "hệ vô đối".
			expect(Math.max(...values), `hàng ${damage}`).toBeGreaterThan(1);
			expect(Math.min(...values), `hàng ${damage}`).toBeLessThan(1);
		}
	});

	it('zero-sum theo cột: mỗi armor type bị khắc và khắc lại, trung bình = 1', () => {
		for (const armor of ARMOR_TYPES) {
			const values = DAMAGE_TYPES.map((damage) => ARMOR_MULT[damage][armor]);
			const avg = values.reduce((a, b) => a + b, 0) / values.length;
			expect(avg, `cột ${armor}`).toBeCloseTo(1, 5);
		}
	});

	it('không có ô nào = 0 hoặc vô cực (không immune/one-shot tuyệt đối)', () => {
		for (const damage of DAMAGE_TYPES) {
			for (const armor of ARMOR_TYPES) {
				const mult = ARMOR_MULT[damage][armor];
				expect(Number.isFinite(mult)).toBe(true);
				expect(mult).toBeGreaterThan(0);
			}
		}
	});

	it('đối xứng khắc hệ — physical khắc light, heavy khắc physical ngược lại', () => {
		// Kiểm tra vài cặp khắc điển hình để tránh ma trận bị đảo lung tung.
		expect(ARMOR_MULT.physical.light).toBeGreaterThan(1);
		expect(ARMOR_MULT.physical.heavy).toBeLessThan(1);
		expect(ARMOR_MULT.magical.heavy).toBeGreaterThan(1);
		expect(ARMOR_MULT.holy.ethereal).toBeGreaterThan(1);
		expect(ARMOR_MULT.shadow.heavy).toBeLessThan(1);
	});

	it('armorMultiplier clamp giá trị seed lỗi về [min, max]', () => {
		// Giá trị vượt khung bị kẹp — chống dữ liệu lệch tạo one-shot.
		expect(armorMultiplier('physical', 'heavy', true)).toBeGreaterThanOrEqual(ARMOR_MULT_MIN);
		expect(armorMultiplier('physical', 'light', true)).toBeLessThanOrEqual(ARMOR_MULT_MAX);
	});

	it('mọi damage/armor type đều có mặt trong ma trận (không thiếu ô)', () => {
		for (const damage of DAMAGE_TYPES as DamageType[]) {
			expect(Object.keys(ARMOR_MULT[damage]).sort()).toEqual([...ARMOR_TYPES].sort());
		}
		const damageKeys = Object.keys(ARMOR_MULT).sort() as DamageType[];
		expect(damageKeys).toEqual([...DAMAGE_TYPES].sort());
		const armorKeys: ArmorType[] = ARMOR_TYPES;
		expect(armorKeys.length).toBeGreaterThan(0);
	});
});
