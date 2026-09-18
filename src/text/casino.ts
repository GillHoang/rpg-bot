import { CURRENCY } from './common.js';

export const CASINO_DESCRIPTION = 'Chơi 1 ván casino (Credux)';
export const CASINO_GAME_OPTION_DESC = 'Trò chơi';
export const CASINO_BET_OPTION_DESC = (maxBet: string): string => `Tiền cược (tối đa ${maxBet})`;
export const CASINO_CHOICE_OPTION_DESC = 'Lựa chọn (coin: heads/tails · dice: odd/even · baccarat: player/banker)';

/** Nhãn hiển thị của 4 game stateless trong menu chọn game. */
export const CASINO_GAME_LABELS = {
	coin_toss: 'Coin Toss',
	dice_roll: 'Dice Roll',
	slot_machine: 'Slot Machine',
	baccarat: 'Baccarat',
} as const;

export const CASINO_NOT_REGISTERED = 'Bạn chưa đăng ký. Dùng `/register` trước đã!';
export const CASINO_INVALID_BET = (maxBet: string): string => `Tiền cược không hợp lệ (1-${maxBet}).`;
export const CASINO_INSUFFICIENT_CREDUX = (have: string): string => `Không đủ ${CURRENCY.credux}. Hiện có ${have}.`;

export const CASINO_WIN = '🎉 **Thắng!**';
export const CASINO_PUSH = '🤝 **Hòa (push).**';
export const CASINO_LOSE = '💸 **Thua.**';

export const CASINO_RESULT_LINE = (verdict: string, result: string, delta: string, balance: string): string =>
	`${verdict} Kết quả: \`${result}\`\n` + `Thay đổi: ${delta} ${CURRENCY.credux} · Số dư: ${balance}`;
