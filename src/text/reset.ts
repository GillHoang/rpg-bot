import { formatNumber } from './format.js';
import { ICONS } from './icons.js';
/**
 * Text lệnh /reset (admin) — sửa wording ngay tại đây.
 */

export const RESET_DESCRIPTION = '[Admin] Xoá toàn bộ dữ liệu người chơi và log gameplay';

export const RESET_CONFIRM_HEADER = (count: number): string =>
	`${ICONS.status.fail} **CẢNH BÁO: RESET TOÀN BỘ DATA**\n\n` +
	`Thao tác này sẽ xoá vĩnh viễn dữ liệu của **${formatNumber(count)} người chơi**: nhân vật, gear, rune, deity, tài nguyên, quest, cosmetic, lịch sử đấu...\n\n` +
	'Catalog game (roster, cosmetic, thưởng bracket) và cấu hình server được giữ nguyên.\n\n' +
	'**Không thể hoàn tác.** Bấm nút bên dưới để xác nhận.';

export const RESET_CONFIRM_LABEL = 'RESET TẤT CẢ';
export const RESET_CANCEL_LABEL = 'Huỷ';

/** Người khác bấm nút reset. */
export const RESET_NOT_YOURS = 'Chỉ người gọi lệnh mới có thể xác nhận.';

/** Caller/bấm nút không nằm trong OWNER_DISCORD_IDS. */
export const RESET_NOT_OWNER = 'Lệnh này chỉ dành cho chủ bot.';

export const RESET_CANCELLED = 'Đã huỷ — không xoá gì cả.';

export const RESET_DONE = (users: number): string =>
	`${ICONS.status.success} Đã reset toàn bộ data: ${formatNumber(users)} người chơi và toàn bộ log gameplay bị xoá. Người chơi cần dùng lại /start.`;

export const RESET_ALREADY_EMPTY = 'Không có dữ liệu người chơi nào để reset.';

/** Display text for commands/admin/ResetCommand. */
export const RESET_FLOW_TEXT = {
	failed: 'Reset thất bại. Vui lòng kiểm tra log trước khi thử lại.',
};
