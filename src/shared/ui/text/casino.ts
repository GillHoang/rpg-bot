import { CURRENCY } from './common.js';
import { ICONS } from './icons.js';

export const CASINO_DESCRIPTION = 'Chơi 1 ván casino (Credux)';
export const CASINO_BET_OPTION_DESC = (maxBet: string): string => `Tiền cược (tối đa ${maxBet})`;
export const CASINO_CHOICE_OPTION_DESC = 'Lựa chọn (coin: heads/tails · dice: odd/even · baccarat: player/banker)';

/** Nhãn hiển thị của 4 game stateless trong menu chọn game. */
export const CASINO_GAME_LABELS = {
	coin_toss: 'Coin Toss',
	dice_roll: 'Dice Roll',
	slot_machine: 'Slot Machine',
	baccarat: 'Baccarat',
} as const;

export const CASINO_NOT_REGISTERED = 'Bạn chưa đăng ký. Gõ `/start` để bắt đầu.';
export const CASINO_INVALID_BET = (maxBet: string): string => `Tiền cược không hợp lệ (1-${maxBet}).`;
export const CASINO_INSUFFICIENT_CREDUX = (have: string): string => `Không đủ ${CURRENCY.credux}. Hiện có ${have}.`;

export const CASINO_WIN = `${ICONS.casino.win} **Thắng!**`;
export const CASINO_PUSH = `${ICONS.casino.push} **Hòa (push).**`;
export const CASINO_LOSE = `${ICONS.casino.lose} **Thua.**`;

export const CASINO_RESULT_LINE = (verdict: string, result: string, delta: string, balance: string): string =>
	`${verdict} Kết quả: \`${result}\`\n` + `Thay đổi: ${delta} ${CURRENCY.credux} · Số dư: ${balance}`;

// --- Session (Blackjack/Crash) ---
export const CASINO_SESSION_BAD_BET = (maxBet: number): string => `Cược từ 1 đến ${maxBet}.`;
export const CASINO_SESSION_NO_REGISTER = 'Gõ /start để đăng ký trước.';
export const CASINO_SESSION_BUSY = 'Bạn đang có một ván chơi. Hoàn tất hoặc chờ hết 60 giây.';
export const CASINO_SESSION_INSUFFICIENT = 'Không đủ Credux.';
export const CASINO_SESSION_NOT_FOUND = 'Không tìm thấy phiên chơi của bạn.';

// --- Nút bấm ---
export const CASINO_NOT_YOUR_ROUND = 'Đây không phải ván của bạn.';
export const CASINO_HIT_LABEL = 'Hit';
export const CASINO_STAND_LABEL = 'Stand';
export const CASINO_PUSH_LABEL = 'Push';
export const CASINO_CASH_OUT_LABEL = 'Cash Out';

// --- Render view (domain/casino/InteractiveGame + session settle) ---
export const CASINO_BLACKJACK_VIEW = (bet: string, player: string, dealer: string): string =>
	`Blackjack · Cược ${bet}\nBạn: ${player}\nNhà cái: ${dealer}`;
export const CASINO_CRASH_VIEW = (bet: string, round: number, multiplier: string, state: string): string =>
	`Crash · Cược ${bet}\nLượt ${round} · Hệ số ${multiplier}x · ${state}`;
export const CASINO_SETTLE_LINE = (view: string, result: string, payout: string, balance: string): string =>
	`${view}\n${result} · Nhận ${payout} · Số dư ${balance} Credux.`;
export const CASINO_HIDDEN_CARD = '[ẩn]';

/** Display text for commands/casino/CasinoCommand. */
export const CASINO_DESCRIPTION_TEXT = {
	blackjack: 'Blackjack: Hit/Stand, hết hạn 60 giây',
	crash: 'Crash: Push/Cash Out, hết hạn 60 giây',
};

/** Display text for services/CasinoSessionService. */
export const CASINO_SESSION_TEXT = {
	finished: (gameText: string | number, payout: string | number): string =>
		`${gameText}\nVán đã kết thúc. Payout: ${payout} Credux.`,
	invalidAction: 'Thao tác không hợp lệ.',
	timeoutHint: '\nTự Stand / Cash Out sau 60 giây tính từ khi mở ván. Tiền cược đã trừ.',
};

/** Trò chơi casino hiển thị ở menu xem trước (read-only). */
export const CASINO_MENU_GAMES = [
	{ icon: ICONS.casinoGame.coin, name: 'Coin Toss', desc: 'Đoán heads/tails · trả 1:1' },
	{ icon: ICONS.casinoGame.dice, name: 'Dice Roll', desc: 'Đoán odd/even' },
	{ icon: ICONS.casinoGame.slots, name: 'Slot Machine', desc: 'Quay slot · RTP 100%' },
	{ icon: ICONS.casinoGame.baccarat, name: 'Baccarat', desc: 'player/banker · banker 1.95x' },
	{ icon: ICONS.casinoGame.blackjack, name: 'Blackjack', desc: 'Hit/Stand · nút 60 giây' },
	{ icon: ICONS.casinoGame.crash, name: 'Crash', desc: 'Push/Cash Out · nút 60 giây' },
] as const;
