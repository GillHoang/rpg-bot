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
};

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
	gateHeader: (id: number, name: string, modifier: string, minLevel: number) =>
		`**Gate ${id} · ${GATE_NAMES[name] ?? name}** · ${GATE_MODIFIERS[modifier] ?? modifier} · Cần Lv.${minLevel}`,
	gateRow: (id: number, name: string, modifier: string, minLevel: number, cleared: number, level: number) =>
		`${gateStatusIcon(cleared, id, minLevel, level)} Gate ${id} · ${GATE_NAMES[name] ?? name} · ${GATE_MODIFIERS[modifier] ?? modifier} · 10 tầng · Cần Lv.${minLevel}`,
	gateRowBoss: (id: number, name: string, modifier: string, minLevel: number, bossLevel: number) =>
		`Gate ${id} · ${GATE_NAMES[name] ?? name} · ${GATE_MODIFIERS[modifier] ?? modifier} · 10 tầng · Cần Lv.${minLevel} → Boss Lv.${bossLevel}`,
	tiersStatus: (cleared: number) => `${cleared}/${TIERS} tầng`,
	tierRow: (tier: GateTierLike, clearedTiers: number) =>
		`${tierStatusIcon(tier.number, clearedTiers)} Tầng ${tier.number}${tier.finalBoss ? ' · Boss' : ''} · Quái Lv.${tier.level}`,
};
