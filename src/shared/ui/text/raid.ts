import { CURRENCY } from './common.js';
import { ICONS } from './icons.js';

export const RAID_DESCRIPTION = 'Khám phá Portal, vượt Gate và chiến đấu với boss';

export const RAID_NO_MONSTERS_SEEDED = 'Chưa có dữ liệu quái vật (mob_roster trống). Báo admin seed dữ liệu.';

export const RAID_WIN = (monsterName: string): string =>
	`${ICONS.outcome.win} **Chiến thắng!** Bạn đã hạ gục ${monsterName}.`;
export const RAID_LOSE = (monsterName: string): string =>
	`${ICONS.outcome.lose} **Thất bại.** ${monsterName} đã đánh bại bạn.`;
export const RAID_DRAW = `${ICONS.outcome.draw} **Hòa.** Cả hai đều gục ngã.`;

export const RAID_REWARD_EXP = (exp: string): string => `${ICONS.reward.exp} +__${exp}__ EXP`;
export const RAID_REWARD_CREDUX = (credux: string): string =>
	`${ICONS.reward.credux} +__${credux}__ ${CURRENCY.credux}`;
export const RAID_REWARD_SHARDS = (shards: number): string =>
	`${ICONS.reward.shards} +__${shards}__ ${CURRENCY.beliefShards}`;
export const RAID_REWARD_LEVEL_UP = (prev: number, next: number): string =>
	`${ICONS.reward.levelUp} **Lên cấp __${prev}__ → __${next}__!**`;

// --- Boss (RaidService) ---
export const BOSS_LEVEL_REQUIRED = (minLevel: number): string => `Boss yêu cầu cấp ${minLevel}.`;
export const BOSS_ALREADY_DONE = 'Đã đánh boss hôm nay. Reset lúc 00:00 Asia/Ho_Chi_Minh.';
export const BOSS_FEE_REQUIRED = (fee: string): string => `Phí vào boss: ${fee} Credux.`;

/** Display text for commands/rpg/RaidCommand. */
export const RAID_FLOW_TEXT = {
	huntDescription: 'Săn mob thường hoặc elite (20%)',
	bossDescription: 'Bakunawa: cấp 10, phí 10.000 Credux, 1 lần/ngày (00:00 giờ Việt Nam)',
	alreadyProcessed: 'Trận đấu này đã được xử lý.',
	previewDescription: 'Mô phỏng 100 trận với loadout hiện tại, ước lượng tỉ lệ thắng (không tốn gì)',
	previewResult: (
		monsterName: string,
		gate: number,
		tier: number,
		sims: number,
		wins: number,
		winRate: string,
		avgRounds: string,
		avgDamage: string,
	) =>
		`Preview Gate ${gate} tầng ${tier} vs ${monsterName} (${sims} mô phỏng): thắng ${wins} · tỉ lệ ${winRate} · trung bình ${avgRounds} hiệp · ${avgDamage} damage.`,
};

/** Display text for render/raidBattleOptions. */
export const RAID_FOOTER_TEXT = {
	bossFee: 'Phí vào boss: -10.000 Credux (reset 00:00 giờ Việt Nam).',
};

/** Compact speed line above the battle log (numbers, no bars, to keep the HUD clean). */
export const RAID_SPD_LINE = (playerName: string, playerSpd: number, enemyName: string, enemySpd: number): string =>
	`${ICONS.stat.speed} **Tốc độ** · ${playerName} **${playerSpd}** · ${enemyName} **${enemySpd}**`;

/** Display text for services/RaidService. */
export const RAID_CONFIRMATION_TEXT = {
	dayChanged: 'Đã sang ngày mới. Hãy xác nhận lại lượt đánh boss.',
};

/** Phase 6 sweep result (instant re-clear at 60%, no chests). */
export const SWEEP_TEXT = {
	description: 'Quét nhanh tầng đã thắng: nhận ngay 60% thưởng, tốn cooldown hunt',
	locked: (gate: number, nextTier: number) =>
		`Chỉ quét được tầng đã thắng (Gate ${gate} đang ở tầng ${nextTier}).`,
	result: (gate: number, tier: number, monster: string, credux: string, exp: string, shards: number) =>
		`Quét Gate ${gate} tầng ${tier} (${monster}): +${credux} Credux · +${exp} EXP${shards > 0 ? ` · +${shards} Shards` : ''}.`,
};
