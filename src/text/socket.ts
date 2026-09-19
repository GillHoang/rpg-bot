export const SOCKET_DESCRIPTION = 'Gắn/tháo rune vào trang bị';

export const SOCKET_EQUIP_SUB_DESC = 'Gắn rune vào 1 slot native của trang bị';
export const SOCKET_UNEQUIP_SUB_DESC = 'Tháo rune khỏi trang bị';
export const SOCKET_RUNE_OPTION_DESC = 'UID của rune';
export const SOCKET_GEAR_OPTION_DESC = 'ID vũ khí/giáp';
export const SOCKET_SLOT_OPTION_DESC = 'Số thứ tự slot (1, 2, ...)';

export const SOCKET_RUNE_NOT_OWNED = 'Bạn không sở hữu rune này.';
export const SOCKET_GEAR_NOT_OWNED = 'Bạn không sở hữu trang bị này.';
export const SOCKET_INVALID_SLOT = 'Trang bị không có slot số đó (hoặc chưa mở khoá).';
export const SOCKET_SLOT_OCCUPIED = 'Slot này đã có rune khác. Hãy tháo trước.';

export const SOCKET_LANE_MISMATCH = (expected: string, actual: string): string =>
	`Sai lane: slot yêu cầu **${expected}**, rune này là **${actual}**.`;

export const SOCKET_EQUIP_SUCCESS = '✅ Đã gắn rune vào trang bị.';
export const SOCKET_NOT_SOCKETED = 'Rune này chưa được gắn vào đâu cả.';
export const SOCKET_UNEQUIP_SUCCESS = '✅ Đã tháo rune khỏi trang bị.';

// --- unlock ---
export const SOCKET_UNLOCK_NO_REGISTER = 'Dùng /register trước.';
export const SOCKET_UNLOCK_NOT_OWNED = 'Bạn không sở hữu gear này.';
export const SOCKET_UNLOCK_LIMIT =
	'Gear đã đạt giới hạn socket hoặc chưa có giá mở slot. Slot 1 native/opposite luôn miễn phí.';
export const SOCKET_UNLOCK_COST_NEEDED = (creux: number, essenceCost: number, tier: string): string =>
	`Cần ${creux} Credux + ${essenceCost} ${tier} essence.`;
export const SOCKET_UNLOCK_DONE = (slot: number): string => `Đã mở native socket ${slot}.`;
export const SOCKET_UNLOCK_SUB_DESC = 'Mở thêm native socket bằng Credux và essence';
export const SOCKET_UNLOCK_GEAR_OPTION_DESC = 'ID gear';
export const SOCKET_LANE_OPTION_DESC = 'Lane rune (xem /inventory)';
