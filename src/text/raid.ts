import { CURRENCY } from './common.js';

export const RAID_DESCRIPTION = 'Chiến đấu với một quái vật ngẫu nhiên';

export const RAID_NO_MONSTERS_SEEDED = 'Chưa có dữ liệu quái vật (mob_roster trống). Báo admin seed dữ liệu.';

export const RAID_WIN = (monsterName: string): string => `🏆 **Chiến thắng!** Bạn đã hạ gục ${monsterName}.`;
export const RAID_LOSE = (monsterName: string): string => `💀 **Thất bại.** ${monsterName} đã đánh bại bạn.`;
export const RAID_DRAW = `⚖️ **Hòa.** Cả hai đều gục ngã.`;

export const RAID_REWARD_EXP = (exp: string): string => `✨ +${exp} EXP`;
export const RAID_REWARD_CREDUX = (credux: string): string => `🪙 +${credux} ${CURRENCY.credux}`;
export const RAID_REWARD_SHARDS = (shards: number): string => `🔮 +${shards} ${CURRENCY.beliefShards}`;
export const RAID_REWARD_CHEST = `🎁 +1 Silver Chest`;
export const RAID_REWARD_LEVEL_UP = (prev: number, next: number): string => `⬆️ **Lên cấp ${prev} → ${next}!**`;

export const RAID_ROUND_SUMMARY = (rounds: number, playerHp: number, enemyHp: number): string =>
	`Số vòng: ${rounds} · HP còn lại — Bạn: ${playerHp} / Quái: ${enemyHp}\n\n`;

/** Giới hạn ký tự của battle log trong 1 tin nhắn Discord. */
export const RAID_MAX_LOG_CHARS = 1200;
export const RAID_LOG_TRUNCATE_PREFIX = '…\n';
