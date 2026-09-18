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
