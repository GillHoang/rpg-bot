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
