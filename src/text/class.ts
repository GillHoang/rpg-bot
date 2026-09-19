/** Text lệnh /class — sửa wording ngay tại đây. */

export const CLASS_DESCRIPTION = 'Quản lý class nhân vật';
export const CLASS_CHANGE_DESC = 'Đổi class bằng Change-Class Token (mua ở /pvp shop)';
export const CLASS_NEW_CLASS_OPTION_DESC = 'Class mới';

export const CLASS_INVALID = 'Class không hợp lệ.';
export const CLASS_NO_CHARACTER = 'Dùng /create trước.';
export const CLASS_NO_REGISTER = 'Dùng /register trước.';
export const CLASS_NO_TOKEN = 'Cần 1 Change-Class Token (mua ở /pvp shop).';
export const CLASS_SAME = 'Bạn đã là class này rồi.';
export const CLASS_CHANGED = (name: string, left: number): string =>
	`🔄 Đã đổi class sang **${name}**. Level/exp/gear/deity giữ nguyên. (Còn ${left} token)`;
