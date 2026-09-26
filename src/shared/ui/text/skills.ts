/** Display text cho skill system (Phase 2). Tên/mô tả ở đây, số liệu ở shared/config/skills.ts. */

export const SKILL_NAMES: Readonly<Record<string, string>> = {
	rend: 'Xé Xác',
	warcry: 'Chiến Hống',
	execute: 'Hành Quyết',
	bloodlust: 'Khát Máu',
	sunder: 'Phá Giáp',
	frenzy: 'Cuồng Nộ',
	stomp: 'Dậm Đất',
	bloodboil: 'Huyết Sôi',
	fireball: 'Cầu Lửa',
	frostbolt: 'Tên Băng',
	surge: 'Bùng Nổ Ma Thuật',
	manashield: 'Khiên Mana',
	smite: 'Trừng Phạt',
	rally: 'Hiệu Triệu',
	aegiswall: 'Tường Aegis',
	retribution: 'Báo Ứng',
	aimed: 'Ngắm Bắn',
	volley: 'Mưa Tên',
	snare: 'Bẫy Rễ',
	fielddressing: 'Băng Bó',
};

export const SKILL_DESCS: Readonly<Record<string, string>> = {
	rend: 'Gây chảy máu 2 lượt kèm đòn đánh mạnh hơn.',
	warcry: 'Xóa 2 hiệu ứng xấu và hồi một ít HP.',
	execute: 'Sát thương tăng mạnh theo HP đã mất của địch.',
	bloodlust: 'Hút một phần sát thương thành HP.',
	sunder: 'Bào mòn giáp địch và xuyên một phần DEF.',
	frenzy: 'Dồn toàn lực vào một đòn hủy diệt.',
	stomp: 'Dậm đất làm choáng váng địch.',
	bloodboil: 'Sôi máu hồi lượng lớn HP.',
	fireball: 'Quả cầu lửa gây bỏng 2 lượt.',
	frostbolt: 'Tên băng làm chậm địch.',
	surge: 'Nén ma thuật thành đòn chắc chắn chí mạng.',
	manashield: 'Dựng khiên mana chặn sát thương.',
	smite: 'Giáng đòn trừng phạt mạnh mẽ.',
	rally: 'Hiệu triệu hồi HP và xóa hiệu ứng xấu.',
	aegiswall: 'Dựng tường khiên vừa chặn vừa hồi HP.',
	retribution: 'Đòn báo ứng kèm hút máu.',
	aimed: 'Ngắm kỹ xuyên giáp chính xác.',
	volley: 'Mưa tên đánh thêm một đòn nữa.',
	snare: 'Bẫy rễ làm chậm địch nặng.',
	fielddressing: 'Băng bó hồi HP giữa trận.',
};

export const SKILL_CAST = (name: string): string => `${name} tung chiêu!`;

export const SKILL_DESCRIPTION = 'Tuyệt kỹ chiến đấu (tốn resource, chờ hồi chiêu)';
export const SKILL_SLOT_OPTION_DESC = 'Ô skill (1 hoặc 2, trống để gỡ)';
export const SKILL_KEY_OPTION_DESC = 'Tên skill của class hiện tại';
export const SKILL_ORDER_OPTION_DESC = 'Thế trận: aggressive/balanced/defensive/counter';

export const SKILL_NOT_REGISTERED = 'Bạn chưa đăng ký. Gõ `/start` để bắt đầu.';
export const SKILL_UNKNOWN = 'Skill không tồn tại.';
export const SKILL_WRONG_CLASS = 'Skill này không thuộc class của bạn.';
export const SKILL_INVALID_SLOT = 'Ô skill chỉ nhận 1 hoặc 2 (trống để gỡ).';
export const SKILL_INVALID_ORDER = 'Thế trận chỉ nhận aggressive/balanced/defensive/counter.';
export const SKILL_EQUIPPED = (name: string, slot: number): string => `Đã gắn ${name} vào ô ${slot}.`;
export const SKILL_UNEQUIPPED = (slot: number): string => `Đã gỡ skill ở ô ${slot}.`;
export const SKILL_ORDER_SET = (order: string): string => `Đã đổi thế trận thành ${order}.`;
export const SKILL_LIST_HEADER = 'Tuyệt kỹ của class bạn (mang tối đa 2 vào trận):';
export const SKILL_LIST_LINE = (name: string, kind: string, cost: number, cooldown: number, desc: string): string =>
	`**${name}** (${kind} · ${cost} resource · chờ ${cooldown}) — ${desc}`;
export const SKILL_LIST_FOOTER = '`/skill equip` để gắn · `/skill order` để đổi thế trận.';
