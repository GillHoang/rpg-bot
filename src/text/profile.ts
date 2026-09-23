import type { CombatClass } from '../domain/entities/PlayerAccount.js';
import { UNICODE_ICONS } from './icons.js';

/** Text vẽ trên thẻ profile (ProfileCardRenderer). */
export const PROFILE_DESCRIPTION = 'Xem thẻ nhân vật của bạn';

export const PROFILE_MAX_LEVEL_SUFFIX = ' (MAX)';
export const PROFILE_LEVEL_PREFIX = 'Lv.';
export const PROFILE_CLASS_SEPARATOR = '·';

export const PROFILE_STAT_LABELS = {
	hp: 'HP',
	atk: 'ATK',
	def: 'DEF',
	crit: 'CRIT',
} as const;

export const PROFILE_EXP_LABEL = 'EXP';

/** Display text for render/ProfileCardRenderer. */
export const PROFILE_EXTRA_TEXT = {
	believer: (icon: string | number, level: string | number, exp: string | number): string =>
		`${icon} Believer Lv.${level} (${exp} exp)`,
	rating: (icon: string | number, rating: string | number): string => `${icon} ${rating} rated`,
};

/** Canvas needs Unicode even when Discord class icons use custom emoji. */
export const PROFILE_CLASS_ICONS = {
	Swordsman: UNICODE_ICONS.combatClass.swordsman,
	Fighter: UNICODE_ICONS.combatClass.fighter,
	Mage: UNICODE_ICONS.combatClass.mage,
	Knight: UNICODE_ICONS.combatClass.knight,
	Archer: UNICODE_ICONS.combatClass.archer,
} as const satisfies Record<CombatClass, string>;
