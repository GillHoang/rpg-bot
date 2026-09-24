import { TITLES_TEXT } from '../../../shared/ui/text/catalog/titles.js';
/**
 * SEED DATA — title_catalog (M7, số liệu mặc định mới).
 * Source: believer | rank_season | boss_feat | collection | event
 * Title được grant tự động khi đạt điều kiện (duel/boss/ranked promotion)
 * hoặc mua qua /pvp shop; equip qua /title.
 */
export interface TitleSeed {
	code: string;
	display: string;
	source: 'believer' | 'rank_season' | 'boss_feat' | 'collection' | 'event';
	howTo: string;
}

export const TITLE_SEED: TitleSeed[] = [
	{
		code: 'first_blood',
		display: TITLES_TEXT['first_blood'].display,
		source: 'event',
		howTo: TITLES_TEXT['first_blood'].howTo,
	},
	{
		code: 'boss_slayer',
		display: TITLES_TEXT['boss_slayer'].display,
		source: 'boss_feat',
		howTo: TITLES_TEXT['boss_slayer'].howTo,
	},
	{
		code: 'rank_champion',
		display: TITLES_TEXT['rank_champion'].display,
		source: 'rank_season',
		howTo: TITLES_TEXT['rank_champion'].howTo,
	},
	{
		code: 'rank_demigod',
		display: TITLES_TEXT['rank_demigod'].display,
		source: 'rank_season',
		howTo: TITLES_TEXT['rank_demigod'].howTo,
	},
	{
		code: 'rank_ascendant',
		display: TITLES_TEXT['rank_ascendant'].display,
		source: 'rank_season',
		howTo: TITLES_TEXT['rank_ascendant'].howTo,
	},
	{
		code: 'rank_divine',
		display: TITLES_TEXT['rank_divine'].display,
		source: 'rank_season',
		howTo: TITLES_TEXT['rank_divine'].howTo,
	},
	{
		code: 'streak_master',
		display: TITLES_TEXT['streak_master'].display,
		source: 'event',
		howTo: TITLES_TEXT['streak_master'].howTo,
	},
	{
		code: 'devout_believer',
		display: TITLES_TEXT['devout_believer'].display,
		source: 'believer',
		howTo: TITLES_TEXT['devout_believer'].howTo,
	},
	{
		code: 'arena_legend',
		display: TITLES_TEXT['arena_legend'].display,
		source: 'event',
		howTo: TITLES_TEXT['arena_legend'].howTo,
	},
];
