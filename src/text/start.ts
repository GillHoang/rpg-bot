import { ICONS } from './icons.js';
/**
 * Text quy trình /start — onboarding một chạm: welcome → đồng ý → chọn
 * class → xác nhận. Sửa wording ngay tại đây.
 */

export const START_DESCRIPTION = 'Bắt đầu hành trình của bạn tại Credd';

/** Người chơi đã có nhân vật — không cho vào flow lại. */
export const START_ALREADY_DONE = 'Bạn đã có nhân vật rồi. Dùng `/balance` hoặc lệnh profile để xem.';

/** Màn 1: thông tin bot + điều khoản ngắn gọn, kèm nút Đồng ý / Không đồng ý. */
export const START_WELCOME =
	`${ICONS.summon.header} **Chào mừng đến với Credd**\n\n` +
	'Credd là RPG Discord: bạn vào vai Người Tin Dưỡng Cuối Cùng, chiến đấu qua raid, ' +
	'duel và ranked để triệu hồi các vị thần.\n\n' +
	'- Tạo 1 nhân vật, chọn 1 trong 5 class\n' +
	'- Nhận gear khởi đầu và quà tân thủ\n' +
	'- Đánh bại mob để luyện cấp và sưu tầm deity\n\n' +
	'Bấm **Đồng ý** để xem các class và chọn class khởi đầu của bạn.';

/** Người khác bấm nút trong flow của ai đó. */
export const START_NOT_YOUR_FLOW = 'Quy trình này không phải của bạn. Gõ /start để bắt đầu của riêng bạn.';

/** Màn 2: danh sách class (đi kèm nội tại + chỉ số từng class). */
export const START_CLASSES_TITLE =
	'**Chọn class khởi đầu của bạn**\n\nBấm nút class bên dưới để xem lại chi tiết rồi xác nhận.';

/** Màn 3: xác nhận class đã chọn. */
export const START_CONFIRM_HEADER = (emoji: string, name: string): string => `${emoji} **Xác nhận chọn ${name}?**`;

export const START_CONFIRM_NOTE = 'Lựa chọn này là cuối cùng — không thể đổi sau khi tạo nhân vật.';

/** Nút. */
export const START_AGREE_LABEL = 'Đồng ý';
export const START_DECLINE_LABEL = 'Không đồng ý';
export const START_BACK_LABEL = 'Quay lại';
export const START_CONFIRM_LABEL = 'Xác nhận';

/** Từ chối điều khoản — kết thúc flow, hướng dẫn gọi lại /start. */
export const START_DECLINED = 'Đã hủy quy trình. Khi sẵn sàng, gõ /start để bắt đầu lại — Credd vẫn đợi bạn.';

/** Màn thành công sau khi tạo nhân vật xong. */
export const START_SUCCESS = (
	emoji: string,
	className: string,
	passiveName: string,
	shards: string,
	chests: number,
	weaponId: string,
	armorId: string,
): string =>
	`${ICONS.status.success} ${emoji} **Hành trình bắt đầu — ${className}**\n\n` +
	`Nội tại: ${passiveName}\n` +
	`Gear khởi đầu: \`${weaponId}\` (vũ khí) · \`${armorId}\` (giáp)\n` +
	`Quà tân thủ: +${shards} Belief Shards · +${chests} Silver Chests\n\n` +
	'Bước tiếp theo: `/daily` nhận quà → `/raid hunt` luyện cấp → `/summon` triệu hồi deity.\n' +
	'`/open` mở rương · `/inventory` xem ID · `/equip` trang bị · `/runes shop` mua rune.';
