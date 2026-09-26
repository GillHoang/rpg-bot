import { ICONS } from './icons.js';
import type { WeeklyModifier } from '../../config/weeklyModifiers.js';

/** Phase 4 weekly modifier display text (config holds only the rotation logic). */
export const WEEKLY_MODIFIER_TEXT: Readonly<Record<WeeklyModifier, { name: string; desc: string }>> = {
	none: { name: 'Tuần yên tĩnh', desc: 'Không có biến động.' },
	bloodmoon: { name: 'Huyết Nguyệt', desc: 'Sudden death bắt đầu từ hiệp 16.' },
	frenzy: { name: 'Cuồng Nộ', desc: 'Cả hai bên +20% sát thương.' },
	drought: { name: 'Hạn Hán', desc: 'Mọi hồi máu giảm một nửa.' },
};

/** Weekly line shared by gate panels, /raid gates and the battle log header. */
export const WEEKLY_LINE = (name: string, desc: string): string =>
	`${ICONS.quest.weeklyHeader} Tuần này: **${name}** — ${desc}`;
