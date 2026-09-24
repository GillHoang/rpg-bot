import { CURRENCY } from './common.js';
import { ICONS } from './icons.js';

export const ENHANCE_DESCRIPTION = 'Nâng cấp trang bị (+1 mỗi lần thử)';
export const ENHANCE_GEAR_OPTION_DESC = 'ID vũ khí/giáp';

export const ENHANCE_NOT_FOUND = 'Không tìm thấy trang bị này thuộc về bạn.';
export const ENHANCE_MAXED = 'Trang bị đã đạt mức tối đa hoặc không thể nâng cấp.';

export const ENHANCE_INSUFFICIENT_CREDUX = (needed: string, have: string): string =>
	`Không đủ ${CURRENCY.credux}. Cần ${needed}, hiện có ${have}.`;

export const ENHANCE_SUCCESS = (newLevel: number, cost: string): string =>
	`${ICONS.status.success} **Thành công!** Trang bị lên +${newLevel}. (-${cost} ${CURRENCY.credux})`;

export const ENHANCE_FAILURE = (cost: string): string =>
	`${ICONS.status.fail} **Thất bại.** Trang bị giữ nguyên cấp độ. (-${cost} ${CURRENCY.credux})`;
