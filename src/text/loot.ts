/** Text loot — service /open·/runes và 2 lệnh — sửa wording ngay tại đây. */

// --- /open ---
export const OPEN_BAD_COUNT = 'Chọn loại rương hợp lệ, số lượng 1–10.';
export const OPEN_NO_REGISTER = 'Dùng /register trước.';
export const OPEN_NO_CHESTS = 'Không đủ rương.';
export const OPEN_RESULT = (count: number, label: string, creux: string, shards: number): string =>
	`Mở ${count} ${label}: +${creux} Credux · +${shards} Shards`;
export const OPEN_ITEM_ESSENCE = (field: string): string => `+1 ${field}`;
export const OPEN_ITEM_RUNE_BAG = (bag: string): string => `+1 túi rune (${bag})`;
export const OPEN_HINT = '\n/equip · /socket · /inventory để sử dụng và tra ID.';
export const OPEN_DESCRIPTION = 'Mở rương nhận tiền, rune và gear';
export const OPEN_CHEST_OPTION_DESC = 'Loại rương';
export const OPEN_COUNT_OPTION_DESC = 'Số lượng (1–10)';

// --- Nhãn túi rune ngắn ---
export const RUNE_BAG_SHORT_LABEL: Record<string, string> = {
	lesserRuneBag: 'lb',
	greaterRuneBag: 'gb',
	divineRuneBag: 'db',
};

// --- /runes shop ---
export const RUNES_DESCRIPTION = 'Shop và túi rune';
export const RUNES_SHOP_DESC = 'Xem giá hoặc mua và mở ngay túi rune (essence + Credux)';
export const RUNES_SHOP_BAG_OPTION_DESC = 'Bỏ trống để xem giá';
export const RUNES_OPEN_DESC = 'Mở 1 túi rune đang có trong bag (từ /open hoặc shop)';
export const RUNES_OPEN_BAG_OPTION_DESC = 'lb = lesser · gb = greater · db = divine';
export const RUNES_SHOP_OFFER = (bagKey: string, essenceCost: number, tier: string, creux: string): string =>
	`**${bagKey}**: ${essenceCost} ${tier} essence + ${creux} Credux`;
export const RUNES_SHOP_POOL = (pool: string): string => `Pool: ${pool}`;
export const RUNES_SHOP_FOOTER = '\n/runes shop bag:<mã> mua và mở ngay 1 rune.';
export const RUNES_BAG_NOT_FOUND = 'Túi rune không tồn tại.';
export const RUNES_COST_NEEDED = (essenceCost: number, tier: string, creux: string): string =>
	`Cần ${essenceCost} ${tier} essence + ${creux} Credux.`;
export const RUNE_POOL_INVALID = 'Pool rune không hợp lệ.';
export const RUNE_RECEIVED = (item: string): string => `Nhận ${item}`;
export const RUNE_RECEIVED_HINT = '\nDùng /socket equip để gắn vào gear; /inventory category:runes xem lane.';

// --- /runes open (túi trong bag) ---
export const RUNE_BAG_BAD_KEY = 'Túi phải là lb | gb | db.';
export const RUNE_BAG_EMPTY = 'Không đủ túi rune. Mở rương để lấy thêm.';
export const RUNE_BAG_OPENED = (bag: string, item: string): string => `Mở túi ${bag}: ${item}`;
export const RUNE_BAG_HINT = '\n/socket equip để gắn vào gear; /inventory category:runes xem lane.';
export const OPEN_ITEM_RELIC = (relic: string): string => `+1 ${relic}`;
