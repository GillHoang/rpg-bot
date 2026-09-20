import { ICONS } from './icons.js';
/** Text lệnh /class — sửa wording ngay tại đây. */

export const CLASS_DESCRIPTION = 'Quản lý class nhân vật';
export const CLASS_CHANGE_DESC = 'Đổi class bằng Change-Class Token (mua ở /pvp shop)';
export const CLASS_NEW_CLASS_OPTION_DESC = 'Class mới';

// --- info ---
export const CLASS_INFO_DESC = 'Xem trước class: flavor, nội tại và chỉ số gốc';
export const CLASS_INFO_OPTION_DESC = 'Class muốn xem';
export const CLASS_INFO_HEADER = (emoji: string, name: string): string => `${emoji} **${name}**`;
export const CLASS_INFO_BASE = (hp: number, atk: number, def: number, crit: string): string =>
	`Chỉ số gốc (level 1): HP ${hp.toLocaleString()} · ATK ${atk.toLocaleString()} · DEF ${def.toLocaleString()} · CRIT ${crit}%`;
export const CLASS_INFO_SCALING = (hp: number, atk: number, def: number, crit: string): string =>
	`Mỗi level: +${hp.toLocaleString()} HP · +${atk.toLocaleString()} ATK · +${def.toLocaleString()} DEF · +${crit}% CRIT`;

export const CLASS_INVALID = 'Class không hợp lệ.';
export const CLASS_NO_CHARACTER = 'Gõ /start để tạo nhân vật trước.';
export const CLASS_NO_REGISTER = 'Gõ /start để đăng ký trước.';
export const CLASS_NO_TOKEN = 'Cần 1 Change-Class Token (mua ở /pvp shop).';
export const CLASS_SAME = 'Bạn đã là class này rồi.';
export const CLASS_CHANGED = (name: string, left: number): string =>
	`${ICONS.combatClass.change} Đã đổi class sang **${name}**. Level/exp/gear/deity giữ nguyên. (Còn ${left} token)`;
