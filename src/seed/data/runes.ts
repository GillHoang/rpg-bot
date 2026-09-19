/**
 * SEED DATA — rune_roster
 * ---------------------------------------------------------------------------
 * Sửa text + giá trị ở file này rồi chạy `npm run db:seed`.
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
		name: 'Rune of Sharpness',
		lane: 'native',
		effectKey: 'sharpness',
		tier: 'Rare',
		value: 0.05,
		description: '+5% ATK while socketed.',
		isAvailable: true,
	},
	{
		name: 'Rune of Precision',
		lane: 'native',
		effectKey: 'precision',
		tier: 'Rare',
		value: 0.03,
		description: '+3% crit chance while socketed.',
		isAvailable: true,
	},
	{
		name: 'Rune of Vitality',
		lane: 'native',
		effectKey: 'vitality',
		tier: 'Rare',
		value: 0.05,
		description: '+5% max HP while socketed.',
		isAvailable: true,
	},
	{
		name: 'Rune of Bulwark',
		lane: 'native',
		effectKey: 'bulwark',
		tier: 'Rare',
		value: 0.05,
		description: '+5% DEF while socketed.',
		isAvailable: true,
	},

	// ── Combat-hook (RuneStrategyDecorator) ──────────────────────────────────
	{
		name: 'Vampiric Rune',
		lane: 'native',
		effectKey: 'vampiric',
		tier: 'Mythic',
		value: 0.1,
		description: 'Heal for 10% of damage dealt.',
		isAvailable: true,
	},
	{
		name: 'Piercing Rune',
		lane: 'native',
		effectKey: 'piercing',
		tier: 'Mythic',
		value: 0.15,
		description: 'Ignore 15% of the target’s DEF.',
		isAvailable: true,
	},
	{
		name: 'Venom Rune',
		lane: 'native',
		effectKey: 'venom',
		tier: 'Mythic',
		value: 0.03,
		description: 'Hits apply Venom: 3% max-HP damage per round, stacking.',
		isAvailable: true,
	},
	{
		name: 'Blight Rune',
		lane: 'native',
		effectKey: 'blight',
		tier: 'Mythic',
		value: 0.1,
		description: 'Hits apply Blight: target deals 10% less damage for 1 round.',
		isAvailable: true,
	},
	{
		name: 'Thorns Rune',
		lane: 'native',
		effectKey: 'thorns',
		tier: 'Mythic',
		value: 0.12,
		description: 'Reflect 12% of damage taken back at the attacker.',
		isAvailable: true,
	},
	{
		name: 'Warding Rune',
		lane: 'native',
		effectKey: 'warding',
		tier: 'Legendary',
		value: 0.15,
		description: 'Reduce incoming damage by 15%.',
		isAvailable: true,
	},
	{
		name: 'Aegis Rune',
		lane: 'opposite',
		effectKey: 'aegis_rune',
		tier: 'Legendary',
		value: 1.0,
		description: 'Once per battle, nullify one incoming hit entirely.',
		isAvailable: true,
	},
	{
		name: 'Rune of Eternity',
		lane: 'native',
		effectKey: 'warding',
		tier: 'Supreme',
		value: 0.25,
		description: 'Reduce incoming damage by 25%.',
		isAvailable: true,
	},

	// ── M7 mở rộng: biến thể cấp cao (append cuối để giữ runeId cũ) ─────────
	{
		name: 'Rune of Sharpness II',
		lane: 'native',
		effectKey: 'sharpness',
		tier: 'Mythic',
		value: 0.08,
		description: '+8% ATK while socketed.',
		isAvailable: true,
	},
	{
		name: 'Rune of Precision II',
		lane: 'native',
		effectKey: 'precision',
		tier: 'Mythic',
		value: 0.015,
		description: '+1.5 crit points while socketed.',
		isAvailable: true,
	},
	{
		name: 'Rune of Vitality II',
		lane: 'native',
		effectKey: 'vitality',
		tier: 'Legendary',
		value: 0.12,
		description: '+12% HP while socketed.',
		isAvailable: true,
	},
	{
		name: 'Rune of Bulwark II',
		lane: 'native',
		effectKey: 'bulwark',
		tier: 'Legendary',
		value: 0.12,
		description: '+12% DEF while socketed.',
		isAvailable: true,
	},
	{
		name: 'Rune of Hemomancy',
		lane: 'opposite',
		effectKey: 'vampiric',
		tier: 'Legendary',
		value: 0.22,
		description: 'Lifesteal 22% of damage dealt.',
		isAvailable: true,
	},
	{
		name: 'Rune of Ruin',
		lane: 'native',
		effectKey: 'sharpness',
		tier: 'Supreme',
		value: 0.15,
		description: '+15% ATK while socketed.',
		isAvailable: true,
	},
];
