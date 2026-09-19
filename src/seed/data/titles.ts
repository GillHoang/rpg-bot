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
		display: 'First Blood',
		source: 'event',
		howTo: 'Thắng duel đầu tiên (/duel).',
	},
	{
		code: 'boss_slayer',
		display: 'Bakunawa Slayer',
		source: 'boss_feat',
		howTo: 'Hạ Bakunawa trong /raid boss.',
	},
	{
		code: 'rank_champion',
		display: 'Arena Champion',
		source: 'rank_season',
		howTo: 'Đạt bracket Champion trong ranked.',
	},
	{
		code: 'rank_demigod',
		display: 'Demigod of the Arena',
		source: 'rank_season',
		howTo: 'Đạt bracket Demigod trong ranked.',
	},
	{
		code: 'rank_ascendant',
		display: 'Ascendant',
		source: 'rank_season',
		howTo: 'Đạt bracket Ascendant trong ranked.',
	},
	{
		code: 'rank_divine',
		display: 'Divine Duelist',
		source: 'rank_season',
		howTo: 'Đạt bracket Divine trong ranked.',
	},
];
