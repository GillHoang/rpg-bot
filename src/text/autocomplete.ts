/**
 * Text autocomplete — nhãn lựa chọn cho /equip, /enhance, /socket (sửa
 * wording ngay tại đây). Discord giới hạn 100 ký tự cho tên choice nên mọi
 * nhãn đều đi qua truncate().
 */

const MAX_LABEL_CHARS = 100;

export const AUTOCOMPLETE_EQUIPPED_MARK = ' · đang dùng';
export const AUTOCOMPLETE_SOCKETED_MARK = ' · đã gắn ';
export const AUTOCOMPLETE_FREE_MARK = ' · rảnh';

export function GEAR_CHOICE_LABEL(e: {
	name: string;
	tier: string;
	plus: number;
	id: string;
	equipped: boolean;
}): string {
	return truncate(`${e.name} +${e.plus} (${e.tier}) — ${e.id}${e.equipped ? AUTOCOMPLETE_EQUIPPED_MARK : ''}`);
}

export function DEITY_CHOICE_LABEL(e: { name: string; tier: string; id: number }): string {
	return truncate(`${e.name} (${e.tier}) — ${e.id}`);
}

export function RUNE_CHOICE_LABEL(e: { name: string; tier: string; uid: string; socketedInto: string | null }): string {
	return truncate(
		`${e.name} (${e.tier}) — ${e.uid}${e.socketedInto ? AUTOCOMPLETE_SOCKETED_MARK + e.socketedInto : AUTOCOMPLETE_FREE_MARK}`,
	);
}

function truncate(label: string): string {
	return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
}
