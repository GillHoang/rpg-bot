import { ICONS } from './icons.js';
/**
 * Chuỗi UI cho battle log pager (Components V2) — điều hướng theo hiệp,
 * mỗi trang hiện HP hai bên dưới dạng progress bar 7 ô.
 */

export const BATTLE_LOG_FIRST_LABEL = `${ICONS.nav.first} Đầu`;
export const BATTLE_LOG_PREV_LABEL = `${ICONS.nav.prev} Trước`;
export const BATTLE_LOG_NEXT_LABEL = `Sau ${ICONS.nav.next}`;
export const BATTLE_LOG_LAST_LABEL = `Cuối ${ICONS.nav.last}`;
export const heartEmoji = '<:heart:1550849637902979142>';
export const BATTLE_LOG_PAGE_INDICATOR = (round: number, total: number): string => `Hiệp ${round}/${total}`;

export const BATTLE_LOG_HP_LINE = (name: string, hp: number, maxHp: number): string => {
	return `**${name}** —  ${heartEmoji} __${hp.toLocaleString()}/${maxHp.toLocaleString()} HP__`;
};

/** Số ô của progress bar HP trong pager. */
export const BATTLE_LOG_HP_CELLS = 7;

/** Trước khi hết hạn, pager vô hiệu nút điều hướng (phút). */
export const BATTLE_LOG_PAGER_TTL_MS = 4 * 60_000;

/** Display text for render/BattleLogPager. */
export const BATTLE_REPLAY_TEXT = {
	button: (seconds: string | number): string => `Đánh lại (${seconds}s)`,
	ownerOnly: 'Chỉ người gọi lệnh mới có thể đánh lại.',
	failed: 'Không thể đánh lại lúc này. Hãy thử lại sau.',
	updateFailed: 'Không thể cập nhật nhật ký lúc này. Hãy thử lại sau.',
	expired: 'Nút đã hết hạn. Hãy dùng /raid hunt.',
	busy: 'Trận đấu đang được xử lý.',
	cooldown: (seconds: string | number): string => `Chờ ${seconds} giây nữa để đánh lại.`,
};
