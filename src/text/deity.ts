import { CURRENCY } from './common.js';

export const DEITY_DESCRIPTION = 'Quản lý Sigil và Ascension của deity';
export const DEITY_SIGIL_SUB_DESC = 'Dùng essence để +1 Sigil cho deity';
export const DEITY_ASCEND_SUB_DESC = 'Ascend deity 10/10 Sigil: danh hiệu prestige, không tăng stat';
export const DEITY_USER_DEITY_OPTION_DESC = 'ID deity sở hữu (xem trong /deities)';
export const DEITY_USER_DEITY_OPTION_DESC_SHORT = 'ID deity sở hữu';

export const DEITY_NOT_OWNED = 'Bạn không sở hữu deity này.';

export const DEITY_SIGIL_MAXED = (max: number): string => `Deity đã đạt tối đa ${max}/${max} Sigil.`;

export const DEITY_INSUFFICIENT_ESSENCE = (needed: number, have: number): string =>
	`Không đủ essence. Cần ${needed}, hiện có ${have}.`;

export const DEITY_SIGIL_SUCCESS = (sigils: number, max: number): string =>
	`✨ Đã +1 Sigil. Hiện tại: ${sigils}/${max}.`;

export const DEITY_ALREADY_ASCENDED = 'Deity này đã Ascend rồi.';

export const DEITY_NOT_ENOUGH_SIGILS = (max: number, have: number): string =>
	`Cần đủ ${max}/${max} Sigil trước (hiện có ${have}).`;

export const DEITY_INSUFFICIENT_RESOURCES = (neededEssence: number, neededCredux: string): string =>
	`Không đủ tài nguyên. Cần ${neededEssence} essence + ${neededCredux} ${CURRENCY.credux}.`;

export const DEITY_ASCEND_SUCCESS =
	'🌟 **Ascension thành công!** Đã nhận trạng thái prestige. Chỉ số giữ ở mức 10/10 Sigil; chưa có bonus stat hoặc blessing.';
