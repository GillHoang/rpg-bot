import { CURRENCY } from './common.js';
import { ICONS } from './icons.js';

export const RAID_DESCRIPTION = 'Chiến đấu với một quái vật ngẫu nhiên';

export const RAID_NO_MONSTERS_SEEDED = 'Chưa có dữ liệu quái vật (mob_roster trống). Báo admin seed dữ liệu.';

export const RAID_WIN = (monsterName: string): string => `${ICONS.outcome.win} **Chiến thắng!** Bạn đã hạ gục ${monsterName}.`;
export const RAID_LOSE = (monsterName: string): string => `${ICONS.outcome.lose} **Thất bại.** ${monsterName} đã đánh bại bạn.`;
export const RAID_DRAW = `${ICONS.outcome.draw} **Hòa.** Cả hai đều gục ngã.`;

export const RAID_REWARD_EXP = (exp: string): string => `${ICONS.reward.exp} +__${exp}__ EXP`;
export const RAID_REWARD_CREDUX = (credux: string): string => `${ICONS.reward.credux} +__${credux}__ ${CURRENCY.credux}`;
export const RAID_REWARD_SHARDS = (shards: number): string => `${ICONS.reward.shards} +__${shards}__ ${CURRENCY.beliefShards}`;
export const RAID_REWARD_CHEST = `${ICONS.reward.chest} +1 Silver Chest`;
export const RAID_REWARD_LEVEL_UP = (prev: number, next: number): string => `${ICONS.reward.levelUp} **Lên cấp __${prev}__ → __${next}__!**`;

export const RAID_ROUND_SUMMARY = (rounds: number, playerHp: number, enemyHp: number): string =>
	`Số vòng: __${rounds}__ · HP còn lại — **Bạn**: __${playerHp}__ / **Quái**: __${enemyHp}__

`;

/** Giới hạn ký tự của battle log trong 1 tin nhắn Discord. */
export const RAID_MAX_LOG_CHARS = 1200;
export const RAID_LOG_TRUNCATE_PREFIX = '…\n';

// --- Boss (RaidService) ---
export const BOSS_LEVEL_REQUIRED = (minLevel: number): string => `Boss yêu cầu cấp ${minLevel}.`;
export const BOSS_ALREADY_DONE = 'Đã đánh boss hôm nay. Reset lúc 00:00 Asia/Manila.';
export const BOSS_FEE_REQUIRED = (fee: string): string => `Phí vào boss: ${fee} Credux.`;
