import { RUNES_TEXT } from '../../text/catalog/runes.js';
/**
 * SEED DATA — rune_roster
 * ---------------------------------------------------------------------------
 * Text hiển thị: src/text/catalog/runes.ts; chạy pnpm db:seed sau khi sửa.
 *
 * lane: 'native' (khớp socket gốc của gear) | 'opposite' (socket chéo)
 * effectKey hợp lệ (config/runes.ts):
 *   stat-%  : sharpness (ATK%) | precision (crit%) | vitality (HP%) | bulwark (DEF%)
 *   combat  : vampiric | piercing | venom | blight | thorns | warding | aegis_rune
 * value: giá trị gốc; user_runes.rolled_value (nếu có) sẽ đè lên giá trị này.
 *
 * runeId = 1..N gán theo thứ tự mảng dưới đây.
 */

export interface RuneSeed {
	name: string;
	lane: 'native' | 'opposite';
	effectKey:
		| 'sharpness'
		| 'precision'
		| 'vitality'
		| 'bulwark'
		| 'vampiric'
		| 'piercing'
		| 'venom'
		| 'blight'
		| 'thorns'
		| 'warding'
		| 'aegis_rune';
	tier: string;
	value: number;
	description: string;
	isAvailable: boolean;
}

export const RUNE_SEED: RuneSeed[] = [
	// ── Stat-% (không cần combat hook) ───────────────────────────────────────
	{
		name: RUNES_TEXT['1'].name,
		lane: 'native',
		effectKey: 'sharpness',
		tier: 'Rare',
		value: 0.05,
		description: RUNES_TEXT['1'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['2'].name,
		lane: 'native',
		effectKey: 'precision',
		tier: 'Rare',
		value: 0.03,
		description: RUNES_TEXT['2'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['3'].name,
		lane: 'native',
		effectKey: 'vitality',
		tier: 'Rare',
		value: 0.05,
		description: RUNES_TEXT['3'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['4'].name,
		lane: 'native',
		effectKey: 'bulwark',
		tier: 'Rare',
		value: 0.05,
		description: RUNES_TEXT['4'].description,
		isAvailable: true,
	},

	// ── Combat-hook (RuneStrategyDecorator) ──────────────────────────────────
	{
		name: RUNES_TEXT['5'].name,
		lane: 'native',
		effectKey: 'vampiric',
		tier: 'Mythic',
		value: 0.1,
		description: RUNES_TEXT['5'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['6'].name,
		lane: 'native',
		effectKey: 'piercing',
		tier: 'Mythic',
		value: 0.15,
		description: RUNES_TEXT['6'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['7'].name,
		lane: 'native',
		effectKey: 'venom',
		tier: 'Mythic',
		value: 0.03,
		description: RUNES_TEXT['7'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['8'].name,
		lane: 'native',
		effectKey: 'blight',
		tier: 'Mythic',
		value: 0.1,
		description: RUNES_TEXT['8'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['9'].name,
		lane: 'native',
		effectKey: 'thorns',
		tier: 'Mythic',
		value: 0.12,
		description: RUNES_TEXT['9'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['10'].name,
		lane: 'native',
		effectKey: 'warding',
		tier: 'Legendary',
		value: 0.15,
		description: RUNES_TEXT['10'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['11'].name,
		lane: 'opposite',
		effectKey: 'aegis_rune',
		tier: 'Legendary',
		value: 1.0,
		description: RUNES_TEXT['11'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['12'].name,
		lane: 'native',
		effectKey: 'warding',
		tier: 'Supreme',
		value: 0.25,
		description: RUNES_TEXT['12'].description,
		isAvailable: true,
	},

	// ── M7 mở rộng: biến thể cấp cao (append cuối để giữ runeId cũ) ─────────
	{
		name: RUNES_TEXT['13'].name,
		lane: 'native',
		effectKey: 'sharpness',
		tier: 'Mythic',
		value: 0.08,
		description: RUNES_TEXT['13'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['14'].name,
		lane: 'native',
		effectKey: 'precision',
		tier: 'Mythic',
		value: 0.015,
		description: RUNES_TEXT['14'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['15'].name,
		lane: 'native',
		effectKey: 'vitality',
		tier: 'Legendary',
		value: 0.12,
		description: RUNES_TEXT['15'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['16'].name,
		lane: 'native',
		effectKey: 'bulwark',
		tier: 'Legendary',
		value: 0.12,
		description: RUNES_TEXT['16'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['17'].name,
		lane: 'opposite',
		effectKey: 'vampiric',
		tier: 'Legendary',
		value: 0.22,
		description: RUNES_TEXT['17'].description,
		isAvailable: true,
	},
	{
		name: RUNES_TEXT['18'].name,
		lane: 'native',
		effectKey: 'sharpness',
		tier: 'Supreme',
		value: 0.15,
		description: RUNES_TEXT['18'].description,
		isAvailable: true,
	},
];
