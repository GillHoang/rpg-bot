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

/**
 * Phase 3 rune resonance (battle-upgrade-plan.md §Trục C) — parallel to deity
 * resonance: socketing 3+ runes of one family across weapon + armor grants a
 * resonance bonus, summed once with the other stat-mods in StatAssembly.
 */
export type RuneGroup = 'offense' | 'defense' | 'mystic';

export const RUNE_GROUP_OF: Readonly<Record<RuneEffectKey, RuneGroup>> = {
	sharpness: 'offense',
	precision: 'offense',
	piercing: 'offense',
	vampiric: 'offense',
	venom: 'offense',
	vitality: 'defense',
	bulwark: 'defense',
	thorns: 'defense',
	warding: 'defense',
	aegis_rune: 'defense',
	swiftness: 'mystic',
	'eagle-eye': 'mystic',
	frost: 'mystic',
	blight: 'mystic',
};

/** Sockets of one group needed to trigger resonance. */
export const RUNE_RESONANCE_THRESHOLD = 3;

export interface RuneResonanceBonus {
	atkPct?: number;
	hpPct?: number;
	defPct?: number;
	critPts?: number;
	spdPct?: number;
	accPts?: number;
}

export const RUNE_RESONANCE_BONUS: Readonly<Record<RuneGroup, RuneResonanceBonus>> = {
	offense: { atkPct: 0.06 },
	defense: { hpPct: 0.06, defPct: 0.06 },
	mystic: { spdPct: 0.06, critPts: 0.015 },
};
