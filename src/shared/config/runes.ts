export type RuneEffectKey =
	| 'sharpness'
	| 'precision'
	| 'vitality'
	| 'bulwark'
	| 'swiftness'
	| 'eagle-eye'
	| 'vampiric'
	| 'piercing'
	| 'venom'
	| 'blight'
	| 'thorns'
	| 'warding'
	| 'aegis_rune'
	| 'frost';

/** Flat stat-% families — read directly by DamageCalculator/CombatantState, no combat hook needed. */
export const STAT_EFFECT_KEYS: readonly RuneEffectKey[] = [
	'sharpness',
	'precision',
	'vitality',
	'bulwark',
	'swiftness',
	'eagle-eye',
];
