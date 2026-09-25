/** Text loadout — service /equip·/preset và 2 lệnh — sửa wording ngay tại đây. */

// --- Service equip/switch ---
export const LOADOUT_NO_CHARACTER = 'Gõ /start để tạo nhân vật trước.';
export const LOADOUT_BAD_PRESET = 'Preset phải là 1 hoặc 2.';
export const LOADOUT_PRESET_MISSING = 'Không tìm thấy preset.';
export const LOADOUT_WEAPON_NOT_OWNED = 'Bạn không sở hữu vũ khí này.';
export const LOADOUT_ARMOR_NOT_OWNED = 'Bạn không sở hữu giáp này.';
export const LOADOUT_DEITY_NOT_OWNED = 'Bạn không sở hữu deity này.';
export const LOADOUT_DEITY_IN_OTHER_SLOT = 'Deity này đã ở slot pantheon khác.';
export const LOADOUT_INVALID_KIND = 'Loại hoặc ID không hợp lệ.';
export const LOADOUT_EQUIPPED = (kind: string, item: string, target: number): string =>
	`Đã trang bị ${kind} ${item} vào preset ${target}. /profile để xem chỉ số.`;
export const LOADOUT_SWITCHED = (slot: number, weapon: string, armor: string, deity: string): string =>
	`Đang dùng preset ${slot}. Weapon: ${weapon} · Armor: ${armor} · Deity: ${deity}\n/equip để thay trang bị.`;
export const LOADOUT_EMPTY = 'trống';

// --- Lệnh /equip ---
export const EQUIP_DESCRIPTION = 'Trang bị gear hoặc deity vào preset';
export const EQUIP_KIND_OPTION_DESC = 'Loại (deity/deity2/deity3 = slot pantheon 1/2/3)';
export const EQUIP_ID_OPTION_DESC = 'ID từ /inventory hoặc /deities';
export const EQUIP_PRESET_OPTION_DESC = 'Mặc định: preset đang dùng';

// --- Lệnh /preset ---
export const PRESET_DESCRIPTION = 'Đổi bộ trang bị';
export const PRESET_SWITCH_DESC = 'Chuyển preset đang dùng';
export const PRESET_SLOT_OPTION_DESC = 'Preset';

export const DEFAULT_PRESET_NAMES = { main: 'Main', secondary: 'Preset 2' };
