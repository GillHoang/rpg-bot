import { CURRENCY } from './common.js';

export const CREATE_DESCRIPTION = 'Tạo nhân vật của bạn';
export const CREATE_CLASS_OPTION_DESC = 'Lớp nhân vật';

export const CREATE_ALREADY_HAS_CHARACTER = 'Bạn đã có nhân vật rồi. Dùng `/balance` hoặc lệnh profile để xem.';
export const CREATE_STARTER_GEAR_MISSING =
	'Tạo nhân vật tạm thời không khả dụng (thiếu dữ liệu gear khởi đầu). Thử lại sau.';

export const CREATE_SUCCESS = (
	emoji: string,
	className: string,
	passiveName: string,
	shards: string,
	chests: number,
): string =>
	`${emoji} **Đã tạo nhân vật — ${className}**\n` +
	`Nội tại: ${passiveName}\n\n` +
	`Đã trang bị gear khởi đầu. Quà tạo nhân vật: +${shards} ${CURRENCY.beliefShards}, ` +
	`+${chests} Silver Chests.\n\n` +
	`Bước tiếp theo: /daily nhận quà → /raid hunt luyện cấp → /summon triệu hồi deity.\n` +
	`/open mở rương · /inventory xem ID · /equip trang bị · /runes shop mua rune.`;
