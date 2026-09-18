export type RuneEffectKey =
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

/** Flat stat-% families — read directly by DamageCalculator/CombatantState, no combat hook needed. */
export const STAT_EFFECT_KEYS: readonly RuneEffectKey[] = ['sharpness', 'precision', 'vitality', 'bulwark'];

/** Families that need a combat hook (RuneStrategyDecorator below implements each). */
export const COMBAT_EFFECT_KEYS: readonly RuneEffectKey[] = [
	'vampiric',
	'piercing',
	'venom',
	'blight',
	'thorns',
	'warding',
	'aegis_rune',
];
