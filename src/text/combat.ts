/**
 * Text battle log hiển thị trong output của /raid (BattleEngine +
 * class strategies + rune decorator). `{name}`/số liệu được chèn lúc chạy.
 * Tên riêng (blessing, rune, hiệu lực như Dizzy/Bleed/CRIT) giữ nguyên.
 */

// --- BattleEngine ---
export const COMBAT_ROUND_HEADER = (round: number): string => `# — Hiệp ${round} —`;
export const COMBAT_UNABLE_TO_ACT = (name: string): string => `- ${name} không thể hành động trong lượt này.`;
export const COMBAT_ATTACK_MISSES_DIZZY = (name: string): string => `- Đòn đánh của ${name} bị trượt (Dizzy)!`;
export const COMBAT_CRIT_SUFFIX = ' (CRIT)';
export const COMBAT_HIT = (
	attacker: string,
	defender: string,
	dealt: string,
	critSuffix: string,
	defeatedSuffix: string,
): string => `- ${attacker} đánh ${defender}, gây ${dealt}${critSuffix} sát thương.${defeatedSuffix}`;
export const COMBAT_DEFEATED_SUFFIX = (name: string): string => `- ${name} đã gục ngã!`;
export const COMBAT_DOT_TICK = (name: string, tick: string, tag: string): string =>
	`- ${name} nhận ${tick} sát thương ${tag}.`;

// --- Tử chiến (sau round 30) ---
export const COMBAT_SUDDEN_DEATH_HEADER = (multiplier: number): string =>
	`- 💀 TỬ CHIẾN — mọi sát thương nhân x${multiplier}!`;

// --- Deity blessing decorator ---
export const COMBAT_BLESSING_GUARDIAN_LIGHT = (name: string, healed: string): string =>
	`- ✨ Guardian Light — ${name} hồi ${healed} HP.`;
export const COMBAT_BLESSING_TAILWIND = (name: string): string =>
	`- 🌬️ Tailwind — ${name} có lợi thế ra đòn trước.`;
export const COMBAT_BLESSING_TIDAL_WRATH = (name: string, bonus: number): string =>
	`- 🌊 Tidal Wrath — ${name} +${bonus}% sát thương khi máu cạn.`;
export const COMBAT_BLESSING_MOON_DEVOURER = (name: string): string =>
	`- 🌑 Moon Devourer — ${name} nuốt trăng, đòn đánh nặng gấp đôi!`;
export const COMBAT_BLESSING_LUNAR_VEIL = (name: string): string =>
	`- 🌙 Lunar Veil — ${name} khoác tấm áo trăng, giảm sát thương đòn kế tiếp.`;
export const COMBAT_BLESSING_SOLAR_FURY = (name: string, bonus: number): string =>
	`- ☀️ Solar Fury — ${name} +${bonus}% sát thương mỗi đòn.`;
export const COMBAT_BLESSING_MOUNTAIN_GRACE = (name: string): string =>
	`- ⛰️ Mountain Grace — ${name} được linh núi che chắn.`;
export const COMBAT_BLESSING_SKY_SOVEREIGN = (name: string): string =>
	`- 🌩️ Sky Sovereign — thiên lệnh hoá giải trọn vẹn đòn đánh vào ${name}!`;

// --- Nội tại class ---
export const COMBAT_SWORDSMAN_ATK_UP = (pct: number): string => `> ⚔️ Nội tại Kiếm Sĩ: ATK tăng ${pct}%.`;
export const COMBAT_SWORDSMAN_BLEED = (stacks: number, maxStacks: number, pct: number): string =>
	`> ⚔️ Nội tại Kiếm Sĩ — gây Chảy máu. Cột: ${stacks}/${maxStacks} (${pct}% ATK mỗi lượt).`;
export const COMBAT_FIGHTER_BASH = (stunTurns: number): string =>
	`> 👊 Nội tại Chiến Binh — Bash! Choáng ${stunTurns} lượt và để đối thủ Dizzy.`;
export const COMBAT_MAGE_OVERCHARGE = (debuffName: string): string =>
	`> 🔮 Nội tại Pháp Sư: Quá Tải — đòn nặng trúng, áp hiệu ${debuffName}.`;
export const COMBAT_KNIGHT_REGEN = (restored: string): string => `> 🛡️ Nội tại Hiệp Sĩ: Hồi ${restored} HP.`;
export const COMBAT_ARCHER_DOUBLE_ATTACK = '> 🏹 Nội tại Cung Thủ — Đánh Đôi!';

// --- Rune decorator ---
export const COMBAT_RUNE_VAMPIRIC = (healed: string): string => `> 🩸 Rune Hút Máu — hồi ${healed} HP.`;
export const COMBAT_RUNE_VENOM = (value: string): string => `> ☠️ Rune Nọc Độc — áp Nhiễm độc (${value}/lượt).`;
export const COMBAT_RUNE_THORNS = (reflected: string): string => `>🌵 Rune Gai — phản lại ${reflected} sát thương.`;
