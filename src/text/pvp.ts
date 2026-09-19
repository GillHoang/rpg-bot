/** Text /pvp shop — sửa wording ngay tại đây. */

export const PVP_DESCRIPTION = 'Cửa hàng Valor Medals';
export const PVP_SHOP_DESC = 'Xem danh sách item và giá Valor';
export const PVP_BUY_DESC = 'Mua item bằng Valor Medals';
export const PVP_ITEM_OPTION_DESC = 'Mã item';

export const PVP_LIST_HEADER = '⚔️ **PVP Shop** (Valor Medals từ weekly quest + /ranked claim)';
export const PVP_ITEM_LINE = (key: string, label: string, cost: number): string =>
	`**${key}** — ${label}: ${cost} valor`;
export const PVP_LIST_FOOTER = '\n/pvp buy item:<key> để mua.';

export const PVP_ITEM_NOT_FOUND = 'Item không tồn tại.';
export const PVP_NO_CHARACTER = 'Dùng /create trước.';
export const PVP_NO_REGISTER = 'Dùng /register trước.';
export const PVP_INSUFFICIENT = (cost: number, have: number): string => `Cần ${cost} Valor Medals (đang có ${have}).`;
export const PVP_TIER_LOCKED = (minLevel: number, have: number): string =>
	`Tier này cần believer level ${minLevel} (hiện có ${have}).`;
export const PVP_SEASON_LIMIT = (limit: number): string => `Đã mua tối đa (${limit}/season) item này.`;
export const PVP_BOUGHT_BAG = (label: string, qty: number): string => `Đã mua ${label}. Bag: +${qty}.`;
export const PVP_BOUGHT_COSMETIC = (label: string): string => `Đã mua ${label}. /cosmetic equip để trang bị.`;
export const PVP_BOUGHT_TITLE = (label: string): string => `Đã mua ${label}. /title equip để đeo.`;
