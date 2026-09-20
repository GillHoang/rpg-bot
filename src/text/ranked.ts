import { ICONS } from './icons.js';
/** Text lệnh /ranked — sửa wording ngay tại đây. */

export const RANKED_DESCRIPTION = 'Ranked PvP: đấu async với loadout của đối thủ ngẫu nhiên cùng tầm rating';
export const RANKED_FIGHT_DESC = 'Tìm đối thủ và đấu 1 trận (Elo)';
export const RANKED_CLAIM_DESC = 'Nhận thưởng tuần theo bracket (cần ≥1 trận trong tuần)';
export const RANKED_STATS_DESC = 'Xem rating, bracket, peak và trạng thái thưởng tuần';

// fight
export const RANKED_NOT_REGISTERED = 'Gõ /start để đăng ký trước.';
export const RANKED_NO_CHARACTER = 'Gõ /start để tạo nhân vật trước.';
export const RANKED_BUSY = 'Bạn đang có một trận ranked khác. Chờ giây lát rồi thử lại.';
export const RANKED_NO_OPPONENT = 'Không tìm thấy đối thủ nào đã đăng ký. Mời thêm người chơi vào server!';
export const RANKED_OUTCOME_DRAW = `${ICONS.outcome.draw} Hòa.`;
export const RANKED_OUTCOME_WIN = `${ICONS.outcome.win} **Thắng!**`;
export const RANKED_OUTCOME_LOSE = `${ICONS.outcome.lose} **Thua.**`;
export const RANKED_MATCHUP = (opponent: string, outcome: string): string => `${outcome} vs \`${opponent}\``;
export const RANKED_RATING_LINE = (
	before: number,
	after: number,
	delta: number,
	bracketBefore: string,
	bracketAfter: string,
	peak: number,
): string =>
	`Rating: **${before} → ${after}** (${delta >= 0 ? '+' : ''}${delta}) · ` +
	`Bracket: ${bracketBefore} → **${bracketAfter}** · Peak ${peak}`;
export const RANKED_SHIELD_NOTE =
	'\n' + ICONS.ranked.shield + ' Demotion shield đã cứu bạn khỏi rớt bracket (đỡ 1 lần).';
export const RANKED_FOOTER = '/ranked claim để nhận thưởng tuần · /ranked stats để xem tổng quan.';
export const RANKED_LOG_MAX_CHARS = 900;
export const RANKED_LOG_TRUNCATE_PREFIX = '…';

// claim
export const RANKED_CLAIM_OK = (bracket: string, creux: string, valor: number): string =>
	`${ICONS.ranked.weeklyReward} Weekly reward (${bracket}): +${creux} Credux · +${valor} Valor Medals`;
export const RANKED_ALREADY_CLAIMED = 'Đã nhận thưởng tuần này rồi. Reset vào thứ Hai (Asia/Manila).';
export const RANKED_NO_FIGHTS = 'Chưa có trận ranked nào trong tuần này.';
export const RANKED_NO_REWARD_ROW = 'Chưa seed bảng ranked_reward — báo admin chạy db:seed.';

// stats
export const RANKED_STATS_HEADER = (rating: number, bracket: string, peak: number): string =>
	`${ICONS.ranked.profileBadge} **Ranked** — Rating **${rating}** (${bracket}) · Peak **${peak}**`;
export const RANKED_STATS_BODY = (wins: number, losses: number, streak: number, shield: string): string =>
	`PvP ${wins}W / ${losses}L · Streak kỷ lục ${streak} · Demotion shield: ${shield}`;
export const RANKED_SHIELD_ON = 'bật';
export const RANKED_SHIELD_OFF = 'đã mất';
export const RANKED_WEEK_STATUS = (week: number, resetDate: string, claimed: boolean): string =>
	`Thưởng tuần ${week} (reset ${resetDate}): ${claimed ? 'đã claim' : 'chưa claim — /ranked claim'}`;
