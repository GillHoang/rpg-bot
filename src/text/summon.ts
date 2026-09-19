import { CURRENCY } from './common.js';

export const SUMMON_DESCRIPTION = 'Triệu hồi vị thần bằng Belief Shards';
export const SUMMON_COUNT_OPTION_DESC = (max: number): string => `Số lượt triệu hồi (1-${max})`;

export const SUMMON_INVALID_COUNT = (max: number): string => `Số lượt phải trong khoảng 1-${max}.`;
export { NO_CHARACTER as SUMMON_NO_CHARACTER } from './common.js';
export const SUMMON_INSUFFICIENT_SHARDS = (needed: string, have: string): string =>
	`Không đủ ${CURRENCY.beliefShards}. Cần ${needed}, hiện có ${have}.`;
export const SUMMON_NO_DEITIES_SEEDED = (tier: string): string =>
	`Chưa có deity nào seed cho tier ${tier} (deity_roster trống). Báo admin.`;

export const SUMMON_DUPE_SUFFIX = (essence: number, tier: string): string => ` (trùng — +${essence} ${tier} Essence)`;
export const SUMMON_NEW_SUFFIX = ' ✨ MỚI';

export const SUMMON_SUCCESS = (pullCount: number, shardsSpent: string, lines: string, pity: number): string =>
	`🔮 **Triệu hồi x${pullCount}** — đã dùng ${shardsSpent} ${CURRENCY.beliefShards}\n\n` +
	`${lines}\n\n` +
	`_Pity hiện tại: ${pity}/500_`;

export const SUMMON_INSUFFICIENT_RELICS = (relic: string, needed: number, have: number): string =>
	`Không đủ ${relic === 'sacred' ? 'Sacred' : 'Supreme'} Relic. Cần ${needed}, hiện có ${have}.`;

export const SUMMON_SUCCESS_RELIC = (pullCount: number, relicLabel: string, lines: string, pity: number): string =>
	`🔮 **Triệu hồi x${pullCount} (relic)** — đã dùng ${relicLabel}\n\n` +
	`${lines}\n\n` +
	`_Pity hiện tại: ${pity}/500 (relic không ảnh hưởng pity)_`;

/** Tên "hạng" hiển thị cạnh tier khi gacha. (Di chuyển từ config/gachaRates.ts) */
export const TIER_ALIAS: Record<string, string> = {
	Epic: 'Remnant',
	Mythic: 'Awakened',
	Legendary: 'Undying',
	Supreme: 'Primordial',
};
export const SUMMON_RELIC_OPTION_DESC = 'Dùng Sacred/Supreme Relic để ép tier (1 relic/lượt, không tốn shards)';
