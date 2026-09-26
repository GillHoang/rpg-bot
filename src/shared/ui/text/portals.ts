import { ICONS } from './icons.js';

/** Tầng tối đa mỗi Gate — đồng bộ với TIERS_PER_GATE ở src/shared/config/portals.ts. */
const TIERS = 10;

interface GateTierLike {
	gate: { name: string };
	number: number;
	finalBoss: boolean;
	level: number;
}

export const GATE_NAMES: Record<string, string> = {
	forest: 'Rừng Khởi Nguyên',
	ruins: 'Phế Tích Cổ',
	abyss: 'Vực Sâu',
	volcano: 'Núi Lửa',
	celestial: 'Thiên Giới',
};

export const GATE_MODIFIERS: Record<string, string> = {
	none: 'Cân bằng',
	tanky: 'Giáp dày (+DEF)',
	aggressive: 'Đánh đau (+ATK)',
	regen: 'Máu dày (+HP)',
	evasive: 'Toàn diện',
	reflect: 'Phản đòn',
	drain: 'Hút máu',
	enrage: 'Cuồng nộ (<50% HP)',
	shielded: 'Khiên mở đầu',
	rupture: 'Xuyên giáp',
};

/** Full modifier label list for a gate (phase 4: gate 4+ shows two). */
export function modifierList(modifiers: readonly string[]): string {
	return modifiers.map((m) => GATE_MODIFIERS[m] ?? m).join(' + ');
}

/** Phase 6 loadout tips per gate modifier (Trục G — gợi ý build khắc chế). */
export const GATE_MODIFIER_TIPS: Record<string, string> = {
	none: 'Build cân bằng dùng được mọi Gate',
	tanky: 'Mang pierce/Mage để ăn giáp dày',
	aggressive: 'Ưu tiên DEF/HP và hồi máu',
	regen: 'Dồn burst, mang execute/bleed',
	evasive: 'Stack ACC/eagle-eye',
	reflect: 'Tránh đòn multi-hit, ưu tiên trâu bò',
	drain: 'Kết liễu nhanh bằng burst',
	enrage: 'Thủ chắc khi quái dưới nửa máu',
	shielded: 'Mang pierce để xuyên khiên mở đầu',
	rupture: 'Stack DEF, tránh giáp mỏng',
};

/** Tip line for a gate's modifiers. */
export function modifierTips(modifiers: readonly string[]): string {
	return `Gợi ý: ${modifiers.map((m) => GATE_MODIFIER_TIPS[m] ?? m).join(' · ')}`;
}

/** Icon trạng thái một Gate: đã thắng boss / đang mở / còn khóa. */
function gateStatusIcon(cleared: number, id: number, minLevel: number, level: number): string {
	if (cleared >= TIERS) return ICONS.status.success;
	if (id === 1 || minLevel <= level) return ICONS.nav.next;
	return ICONS.gear.locked;
}

/** Icon trạng thái một tầng: đã vượt / kế tiếp (vừa mở) / chưa mở. */
function tierStatusIcon(number: number, cleared: number): string {
	if (number <= cleared) return ICONS.status.success;
	if (number === cleared + 1) return ICONS.nav.next;
	return ICONS.gear.locked;
}

export const GATE_TEXT = {
	title: 'Portal · Cổng săn quái',
	chooseGate: 'Chọn Gate (Cửa)',
	chooseTier: 'Chọn tầng',
	enter: 'Vào tầng',
	nextTier: 'Tầng tiếp theo',
	nextGate: 'Gate tiếp theo',
	retryTier: 'Đánh lại tầng này',
	fightTier: (tier: number) => `Tầng ${tier}`,
	description: 'Săn quái theo Gate và tầng; tầng 10 là boss của Gate',
	gateOption: 'Gate muốn vào (1-5)',
	tierOption: 'Tầng muốn đánh trong Gate (1-10)',
	listDescription: 'Xem 5 Gate, số tầng, đặc điểm và level yêu cầu',
	invalid: 'Gate hoặc tầng không hợp lệ.',
	locked: (level: number) => `Gate chưa mở: cần cấp ${level} hoặc thắng boss Gate trước đó.`,
	tierLocked: () => `Tầng chưa mở: phải thắng tầng trước đó trong Gate này.`,
	gateCleared: 'Đã thắng boss Gate này! Chọn Gate tiếp theo để tiếp tục.',
	rules: 'Mỗi Gate có 10 tầng tăng dần, tầng 10 là boss. Vượt boss Gate N để mở Gate N+1 (hoặc đủ level). Thua/hòa giữ nguyên tiến độ tầng. Mở lại menu sẽ quay về màn chọn Gate.',
	gate: (tier: GateTierLike) =>
		`${GATE_NAMES[tier.gate.name] ?? tier.gate.name} · Tầng ${tier.number}/${TIERS}${tier.finalBoss ? ' · Boss' : ''} · Quái Lv.${tier.level}`,
	gateHeader: (id: number, name: string, modifiers: readonly string[], minLevel: number) =>
		`**Gate ${id} · ${GATE_NAMES[name] ?? name}** · ${modifierList(modifiers)} · Cần Lv.${minLevel}`,
	gateRow: (
		id: number,
		name: string,
		modifiers: readonly string[],
		minLevel: number,
		cleared: number,
		level: number,
	) =>
		`${gateStatusIcon(cleared, id, minLevel, level)} Gate ${id} · ${GATE_NAMES[name] ?? name} · ${modifierList(modifiers)} · 10 tầng · Cần Lv.${minLevel}`,
	gateRowBoss: (id: number, name: string, modifiers: readonly string[], minLevel: number, bossLevel: number) =>
		`Gate ${id} · ${GATE_NAMES[name] ?? name} · ${modifierList(modifiers)} · 10 tầng · Cần Lv.${minLevel} → Boss Lv.${bossLevel}`,
	tiersStatus: (cleared: number) => `${cleared}/${TIERS} tầng`,
	/** Phase 6 loadout tips line (see GATE_MODIFIER_TIPS). */
	modifierTips: (modifiers: readonly string[]) => modifierTips(modifiers),
	/** Phase 4 weekly modifier line shown on gate panels + /raid gates. */
	weeklyLine: (name: string, desc: string) => `🗓️ Tuần này: **${name}** — ${desc}`,
	tierRow: (tier: GateTierLike, clearedTiers: number) =>
		`${tierStatusIcon(tier.number, clearedTiers)} Tầng ${tier.number}${tier.finalBoss ? ' · Boss' : ''} · Quái Lv.${tier.level}`,
};
