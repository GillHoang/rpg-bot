/** Display text cho class branch (Phase 3). Tên/mô tả ở đây, số liệu ở shared/config/branches.ts. */
export const BRANCH_NAMES: Readonly<Record<string, string>> = {
	duelist: 'Duelist',
	blademaster: 'Blademaster',
	brawler: 'Brawler',
	juggernaut: 'Juggernaut',
	pyromancer: 'Pyromancer',
	arcanist: 'Arcanist',
	guardian: 'Guardian',
	crusader: 'Crusader',
	sharpshooter: 'Sharpshooter',
	ranger: 'Ranger',
};

export const BRANCH_DESCS: Readonly<Record<string, string>> = {
	duelist: 'Song đấu: +10% ATK, −5% HP.',
	blademaster: 'Bậc thầy kiếm: +5 crit, +5% SPD, −5% DEF.',
	brawler: 'Đấm bốc: +8% ATK, −5% DEF.',
	juggernaut: 'Xe ủi: +10% HP, −3% ATK.',
	pyromancer: 'Lửa: +12% ATK, −8% DEF.',
	arcanist: 'Huyền bí: +4 crit, +5% HP.',
	guardian: 'Hộ vệ: +10% DEF, +5% HP, −5% ATK.',
	crusader: 'Thập tự: +8% ATK, −3% DEF.',
	sharpshooter: 'Xạ thủ: +5 crit, +5% ATK, −5% HP.',
	ranger: 'Tuần lâm: +8% SPD, +5% HP, −2% ATK.',
};
export const BRANCH_DESCRIPTION = 'Chọn nhánh phát triển của class (cấp 40+)';
export const BRANCH_KEY_OPTION_DESC = 'Tên nhánh của class hiện tại';

export const BRANCH_NOT_REGISTERED = 'Bạn chưa đăng ký. Gõ `/start` để bắt đầu.';
export const BRANCH_UNKNOWN = 'Nhánh không tồn tại.';
export const BRANCH_WRONG_CLASS = 'Nhánh này không thuộc class của bạn.';
export const BRANCH_LOW_LEVEL = (min: number): string => `Cần cấp ${min} mới chọn nhánh.`;
export const BRANCH_SET = (name: string): string => `Đã chọn nhánh ${name}. Chỉ số thay đổi ngay trong trận tiếp theo.`;
export const BRANCH_LIST_HEADER = 'Nhánh của class bạn (đổi tự do từ cấp 40):';
export const BRANCH_LIST_LINE = (name: string, desc: string, current: boolean): string =>
	`**${name}** — ${desc}${current ? ' (đang dùng)' : ''}`;
export const BRANCH_LIST_SUBCOMMAND = 'Xem nhánh của class';
export const BRANCH_SET_SUBCOMMAND = 'Chọn nhánh';
