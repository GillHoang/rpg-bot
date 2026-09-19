/**
 * Text battle log hiển thị trong output của /raid, format tag kiểu:
 *   [   PHYS] 🐅 tiger đánh okbroomer, gây 95 HP
 *   [ LIFEST] 🩸 gdeer hút 79 HP
 * Tag được pad cố định 8 ký tự để thẳng cột trong codeblock Discord.
 * Tên riêng (blessing, rune, hiệu lực như Dizzy/CRIT/HP) giữ nguyên.
 */

/** Tag gọn — log hiển thị ngoài codeblock nên markdown (bold/underline) hoạt động. */
export function combatTag(tag: string): string {
	return `[${tag.trim()}]`;
}

export const COMBAT_TAGS = {
	PHYS: '   PHYS',
	CRIT: '   CRIT',
	SKILL: '  SKILL',
	BLEED: ' BLEED',
	BURN: '  BURN',
	VENM: '  VENM',
	LIFEST: ' LIFEST',
	THORN: ' THORN',
	REGEN: ' REGEN',
	GUARD: '  GUARD',
	DIZZY: ' DIZZY',
	STUNN: ' STUNN',
	BLESS: ' BLESS',
	AEGIS: ' AEGIS',
	FRENZY: 'FRENZY',
	ECLIPS: 'ECLIPS',
} as const;

export const COMBAT_ROUND_HEADER = (round: number): string => `— Hiệp ${round} —`;
export const COMBAT_SUDDEN_DEATH_HEADER = (multiplier: number): string =>
	`💀 TỬ CHIẾN — mọi sát thương nhân x${multiplier}!`;

export const COMBAT_DEFEATED_SUFFIX = (name: string): string => ` — ${name} gục ngã!`;

export const COMBAT_HIT = (tag: string, attacker: string, defender: string, dealt: string, defeatedSuffix: string): string =>
	`${combatTag(tag)} ${attacker} đánh ${defender}, gây __${dealt} HP__.${defeatedSuffix}`;

export const COMBAT_GUARD = (defender: string, pct: number): string =>
	`${combatTag(COMBAT_TAGS.GUARD)} ${defender} chặn __${pct}%__ sát thương.`;

export const COMBAT_DOT_TICK = (tag: string, name: string, tick: string, label: string): string =>
	`${combatTag(tag)} ${name} trừ __${tick} HP__ (${label}).`;

// --- Trạng thái hành động ---
export const COMBAT_UNABLE_TO_ACT = (name: string): string =>
	`${combatTag(COMBAT_TAGS.STUNN)} ${name} không thể hành động trong lượt này.`;
export const COMBAT_ATTACK_MISSES_DIZZY = (name: string): string =>
	`${combatTag(COMBAT_TAGS.DIZZY)} Đòn đánh của ${name} bị trượt (Dizzy)!`;

// --- Nội tại class ---
export const COMBAT_SWORDSMAN_ATK_UP = (name: string, pct: number): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ⚔️ ${name} tăng ${pct}% ATK (tích luỹ).`;
export const COMBAT_SWORDSMAN_BLEED = (name: string, enemy: string, stacks: number, maxStacks: number, pct: number): string =>
	`${combatTag(COMBAT_TAGS.BLEED)} ⚔️ ${name} áp Chảy máu lên ${enemy} (cột ${stacks}/${maxStacks}, ${pct}% ATK mỗi lượt).`;
export const COMBAT_FIGHTER_BASH = (name: string, enemy: string, stunTurns: number): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} 👊 ${name} Bash ${enemy} — choáng ${stunTurns} lượt và để đối thủ Dizzy.`;
export const COMBAT_MAGE_OVERCHARGE = (name: string, debuffName: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} 🔮 ${name} Quá Tải — áp hiệu ${debuffName}.`;
export const COMBAT_KNIGHT_REGEN = (name: string, restored: string): string =>
	`${combatTag(COMBAT_TAGS.REGEN)} 🛡️ ${name} hồi __${restored} HP__.`;
export const COMBAT_ARCHER_DOUBLE_ATTACK = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} 🏹 ${name} kích hoạt Đánh Đôi!`;

// --- Rune decorator ---
export const COMBAT_RUNE_VAMPIRIC = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.LIFEST)} 🩸 ${name} hút __${healed} HP__.`;
export const COMBAT_RUNE_VENOM = (name: string, enemy: string, value: string): string =>
	`${combatTag(COMBAT_TAGS.VENM)} ☠️ ${name} nhiễm độc ${enemy} (${value} HP mỗi lượt).`;
export const COMBAT_RUNE_THORNS = (name: string, reflected: string): string =>
	`${combatTag(COMBAT_TAGS.THORN)} 🌵 ${name} phản lại __${reflected} HP__.`;
export const COMBAT_RUNE_AEGIS = (name: string): string =>
	`${combatTag(COMBAT_TAGS.AEGIS)} 🛡️ ${name} hoá giải trọn vẹn đòn đánh.`;

// --- Deity blessing decorator ---
export const COMBAT_BLESSING_GUARDIAN_LIGHT = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.REGEN)} ✨ Guardian Light — ${name} hồi __${healed} HP__.`;
export const COMBAT_BLESSING_TAILWIND = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} 🌬️ Tailwind — ${name} có lợi thế ra đòn trước.`;
export const COMBAT_BLESSING_TIDAL_WRATH = (name: string, bonus: number): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} 🌊 Tidal Wrath — ${name} +${bonus}% sát thương khi máu cạn.`;
export const COMBAT_BLESSING_MOON_DEVOURER = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} 🌑 Moon Devourer — ${name} nuốt trăng, đòn đánh nặng gấp đôi!`;
export const COMBAT_BLESSING_LUNAR_VEIL = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} 🌙 Lunar Veil — sát thương đòn kế tiếp vào ${name} bị giảm.`;
export const COMBAT_BLESSING_SOLAR_FURY = (name: string, bonus: number): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ☀️ Solar Fury — ${name} +${bonus}% sát thương mỗi đòn.`;
export const COMBAT_BLESSING_MOUNTAIN_GRACE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ⛰️ Mountain Grace — ${name} vào thế phòng thủ.`;
export const COMBAT_BLESSING_SKY_SOVEREIGN = (name: string): string =>
	`${combatTag(COMBAT_TAGS.AEGIS)} 🌩️ Sky Sovereign — thiên lệnh hoá giải trọn vẹn đòn đánh vào ${name}!`;

// --- Monster skills ---
export const COMBAT_MONSTER_ECLIPSE = (): string =>
	`${combatTag(COMBAT_TAGS.ECLIPS)} 🌑 Bakunawa bước vào Eclipse — sát thương +50%.`;
export const COMBAT_MONSTER_FRENZY = (name: string): string =>
	`${combatTag(COMBAT_TAGS.FRENZY)} 🩸 ${name} cuồng nộ — sát thương +40%.`;
export const COMBAT_MONSTER_FEAST = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.LIFEST)} 🩸 ${name} tấn __${healed} HP__.`;
export const COMBAT_MONSTER_VENOM_SPIT = (name: string, enemy: string, value: string): string =>
	`${combatTag(COMBAT_TAGS.VENM)} ☠️ ${name} phun nọc vào ${enemy} (${value} HP mỗi lượt).`;
