import { formatNumber } from './format.js';
import { ICONS } from './icons.js';
/**
 * Text lệnh /reset (admin) — sửa wording ngay tại đây.
 */

export const RESET_DESCRIPTION = '[Admin] Xoá dữ liệu người chơi (toàn bộ hoặc theo user)';

export const RESET_ALL_DESCRIPTION = 'Xoá TOÀN BỘ dữ liệu người chơi và log gameplay';
export const RESET_USER_DESCRIPTION = 'Xoá toàn bộ dữ liệu của một user';
export const RESET_USER_OPTION_DESC = 'User cần xoá sạch dữ liệu';

export const RESET_CONFIRM_HEADER = (count: number): string =>
	`${ICONS.status.fail} **CẢNH BÁO: RESET TOÀN BỘ DATA**\n\n` +
	`Thao tác này sẽ xoá vĩnh viễn dữ liệu của **${formatNumber(count)} người chơi**: nhân vật, gear, rune, deity, tài nguyên, quest, cosmetic, lịch sử đấu...\n\n` +
	'Catalog game (roster, cosmetic, thưởng bracket) và cấu hình server được giữ nguyên.\n\n' +
	'**Không thể hoàn tác.** Bấm nút bên dưới để xác nhận.';

export const RESET_CONFIRM_LABEL = 'RESET TẤT CẢ';
export const RESET_CANCEL_LABEL = 'Huỷ';

/** Caller/bấm nút không nằm trong OWNER_DISCORD_IDS. */
export const RESET_NOT_OWNER = 'Lệnh này chỉ dành cho chủ bot.';

export const RESET_CANCELLED = 'Đã huỷ — không xoá gì cả.';

export const RESET_DONE = (users: number): string =>
	`${ICONS.status.success} Đã reset toàn bộ data: ${formatNumber(users)} người chơi và toàn bộ log gameplay bị xoá. Người chơi cần dùng lại /start.`;

export const RESET_ALREADY_EMPTY = 'Không có dữ liệu người chơi nào để reset.';

export const RESET_USER_CONFIRM_HEADER = (username: string, rows: number): string =>
	`${ICONS.status.fail} **CẢNH BÁO: XOÁ DATA USER**\n\n` +
	`Thao tác này sẽ xoá vĩnh viễn **${formatNumber(rows)} dòng dữ liệu** của **${username}**: nhân vật, gear, rune, deity, tài nguyên, quest, cosmetic, lịch sử đấu...\n\n` +
	'**Không thể hoàn tác.** Bấm nút bên dưới để xác nhận.';

export const RESET_USER_DONE = (username: string, rows: number): string =>
	`${ICONS.status.success} Đã xoá sạch data của **${username}**: ${formatNumber(rows)} dòng. User này cần dùng lại /start.`;

export const RESET_USER_NOT_FOUND = 'User này chưa từng chơi — không có dữ liệu nào để xoá.';

/** Dấu vết audit trong dev_logs — format ổn định, đừng đổi tuỳ tiện. */
export const RESET_USER_AUDIT_DETAIL = (discordId: string, deletedRows: number): string =>
	`reset user ${discordId}: ${deletedRows} rows`;

/** Display text for commands/admin/ResetCommand. */
export const RESET_FLOW_TEXT = {
	failed: 'Reset thất bại. Vui lòng kiểm tra log trước khi thử lại.',
};
