import { ICONS } from './icons.js';
/** Text cosmetic + title (service + lệnh) — sửa wording ngay tại đây. */

// --- Cosmetic: list ---
export const COSMETIC_NO_CHARACTER = 'Gõ /start để tạo nhân vật trước.';
export const COSMETIC_LIST_HEADER = `${ICONS.gear.list} **Cosmetics**`;
export const COSMETIC_ENTRY = (id: number, name: string, category: string, tier: string): string =>
	`#${id} ${name} (${category}, tier ${tier})`;
export const COSMETIC_EQUIPPED_MARK = ' · [đang dùng]';
export const COSMETIC_LOCK = (minLevel: number): string => ` · ${ICONS.gear.locked} cần believer level ${minLevel}`;
export const COSMETIC_LIST_FOOTER = '\n/cosmetic equip id:<#> để trang bị.';

// --- Cosmetic: equip ---
export const COSMETIC_NOT_FOUND = 'Cosmetic không tồn tại.';
export const COSMETIC_NOT_OWNED = (tier: string, minLevel: number): string =>
	`Bạn chưa sở hữu cosmetic này (tier ${tier} cần believer level ${minLevel}).`;
export const COSMETIC_TIER_LOCKED = (tier: string, minLevel: number, have: number): string =>
	`Tier ${tier} cần believer level ${minLevel} (hiện có ${have}).`;
export const COSMETIC_EQUIPPED = (name: string, category: string): string => `Đã trang bị ${name} (${category}).`;

// --- Cosmetic: lệnh ---
export const COSMETIC_DESCRIPTION = 'Quản lý cosmetics';
export const COSMETIC_LIST_DESC = 'Xem catalog và item đang sở hữu';
export const COSMETIC_EQUIP_DESC = 'Trang bị cosmetic';
export const COSMETIC_ID_OPTION_DESC = 'Cosmetic ID từ /cosmetic list';

// --- Title: list ---
export const TITLE_LIST_HEADER = `${ICONS.gear.titles} **Titles**`;
export const TITLE_ENTRY = (id: number, display: string): string => `#${id} **${display}**`;
export const TITLE_EQUIPPED_MARK = ' · [đang dùng]';
export const TITLE_LOCK_MARK = ` · ${ICONS.gear.locked}`;
export const TITLE_LIST_FOOTER = '\n/title equip id:<#> để đeo title.';

// --- Title: equip ---
export const TITLE_REMOVED = 'Đã tháo title.';
export const TITLE_NOT_OWNED = 'Bạn chưa có title này.';
export const TITLE_EQUIPPED = 'Đã đeo title.';

// --- Title: lệnh ---
export const TITLE_DESCRIPTION = 'Quản lý titles';
export const TITLE_LIST_DESC = 'Xem danh sách title và cách kiếm';
export const TITLE_EQUIP_DESC = 'Đeo title (id 0 = tháo)';
export const TITLE_ID_OPTION_DESC = 'Title ID từ /title list';

// --- Lỗi nội bộ (thiếu seed) ---
export const COSMETIC_SEED_MISSING = (key: string): string => `Thiếu cosmetic trong seed: ${key}`;
export const TITLE_SEED_MISSING = (code: string): string => `Thiếu title trong seed: ${code}`;
