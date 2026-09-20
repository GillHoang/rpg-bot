import { ICONS } from './icons.js';
/** Text lệnh /duel — sửa wording ngay tại đây. */

export const DUEL_DESCRIPTION = 'Thách đấu 1v1 với người chơi khác (tuỳ chọn cược Credux)';
export const DUEL_OPPONENT_OPTION_DESC = 'Người chơi bị thách đấu';
export const DUEL_STAKE_OPTION_DESC = (min: string): string => `Cược Credux cho cả hai (tối thiểu ${min})`;

export const DUEL_SELF = 'Không thể tự thách chính mình.';
export const DUEL_STAKE_TOO_LOW = (min: string): string => `Cược tối thiểu ${min} Credux (hoặc 0 để giao hữu).`;
export const DUEL_NOT_REGISTERED = (who: string): string => `${who} chưa /start.`;
export const DUEL_NO_CHARACTER = (who: string): string => `${who} chưa /start tạo nhân vật.`;
export const DUEL_BUSY = (who: string): string => `${who} đang có một duel khác chờ xử lý.`;
export const DUEL_INSUFFICIENT_FUNDS = 'Một trong hai người không đủ Credux cho mức cược này.';

export const DUEL_WAGER_LINE = (stake: string): string =>
	`\n${ICONS.duel.wager} **Wager**: ${stake} Credux mỗi bên — winner ăn trọn pot.`;
export const DUEL_CASUAL_LINE = '\n' + ICONS.duel.casual + ' Giao hữu (không cược).';
export const DUEL_CHALLENGE = (challenger: string, opponent: string, wagerLine: string): string =>
	`${ICONS.duel.challenge} **${challenger}** thách đấu **${opponent}**!${wagerLine}\n${ICONS.duel.countdown} Hết hạn sau 60 giây.`;

export const DUEL_ACCEPT_LABEL = 'Chấp nhận';
export const DUEL_DECLINE_LABEL = 'Từ chối';
export const DUEL_ONLY_OPPONENT_BUTTON = 'Chỉ đối thủ mới được chấp nhận.';
export const DUEL_DECLINED = 'Duel đã bị từ chối.';
export const DUEL_EXPIRED = (challenger: string): string => `${ICONS.duel.expired} Duel hết hạn — ${challenger} không dám đánh.`;

// renderDuel
export const DUEL_NOT_FOUND = 'Duel không còn tồn tại.';
export const DUEL_EXPIRED_ACCEPT = 'Duel đã hết hạn.';
export const DUEL_INSUFFICIENT_FUNDS_ACCEPT = 'Một trong hai người không đủ Credux lúc chấp nhận — duel bị huỷ.';
export const DUEL_DRAW = `${ICONS.outcome.draw} **Hòa!** Cược được hoàn lại cho cả hai.`;
export const DUEL_WIN = (winner: string): string => `${ICONS.outcome.win} **\`${winner}\` thắng!**`;
export const DUEL_POT = (stake: string): string => ` Nhận ${stake} Credux.`;
export const DUEL_WHO = { challenger: 'Bạn', opponent: 'Đối thủ' } as const;
