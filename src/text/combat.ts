/**
 * Text battle log hiển thị trong output của /raid (BattleEngine +
 * class strategies + rune decorator). `{name}`/số liệu được chèn lúc chạy.
 */

// --- BattleEngine ---
export const COMBAT_ROUND_HEADER = (round: number): string => `— Round ${round} —`;
export const COMBAT_UNABLE_TO_ACT = (name: string): string => `${name} is unable to act this turn.`;
export const COMBAT_ATTACK_MISSES_DIZZY = (name: string): string => `${name}'s attack misses (Dizzy)!`;
export const COMBAT_CRIT_SUFFIX = ' (CRIT)';
export const COMBAT_HIT = (
	attacker: string,
	defender: string,
	dealt: string,
	critSuffix: string,
	defeatedSuffix: string,
): string => `${attacker} hits ${defender} for ${dealt}${critSuffix} damage.${defeatedSuffix}`;
export const COMBAT_DEFEATED_SUFFIX = (name: string): string => ` ${name} is defeated!`;
export const COMBAT_DOT_TICK = (name: string, tick: string, tag: string): string =>
	`${name} suffers ${tick} ${tag} damage.`;

// --- Sudden death (sau round 30) ---
export const COMBAT_SUDDEN_DEATH_HEADER = (multiplier: number): string =>
	`💀 SUDDEN DEATH — mọi sát thương nhân x${multiplier}!`;

// --- Deity blessing decorator ---
export const COMBAT_BLESSING_GUARDIAN_LIGHT = (name: string, healed: string): string =>
	`✨ Guardian Light — ${name} hồi ${healed} HP.`;
export const COMBAT_BLESSING_TAILWIND = (name: string): string => `🌬️ Tailwind — ${name} có lợi thế ra đòn trước.`;
export const COMBAT_BLESSING_TIDAL_WRATH = (name: string, bonus: number): string =>
	`🌊 Tidal Wrath — ${name} +${bonus}% sát thương khi máu cạn.`;
export const COMBAT_BLESSING_MOON_DEVOURER = (name: string): string =>
	`🌑 Moon Devourer — ${name} nuốt trăng, đòn đánh nặng gấp đôi!`;
export const COMBAT_BLESSING_LUNAR_VEIL = (name: string): string =>
	`🌙 Lunar Veil — ${name} khoác tấm áo trăng, giảm sát thương đòn kế tiếp.`;
export const COMBAT_BLESSING_SOLAR_FURY = (name: string, bonus: number): string =>
	`☀️ Solar Fury — ${name} +${bonus}% sát thương mỗi đòn.`;
export const COMBAT_BLESSING_MOUNTAIN_GRACE = (name: string): string =>
	`⛰️ Mountain Grace — ${name} được linh núi che chắn.`;
export const COMBAT_BLESSING_SKY_SOVEREIGN = (name: string): string =>
	`🌩️ Sky Sovereign — thiên lệnh hoá giải trọn vẹn đòn đánh vào ${name}!`;

// --- Class passives ---
export const COMBAT_SWORDSMAN_ATK_UP = (pct: number): string => `⚔️ Swordsman Passive: ATK increased by ${pct}%.`;
export const COMBAT_SWORDSMAN_BLEED = (stacks: number, maxStacks: number, pct: number): string =>
	`⚔️ Swordsman Passive — applied Bleed. Stack: ${stacks}/${maxStacks} (${pct}% ATK/turn).`;
export const COMBAT_FIGHTER_BASH = (stunTurns: number): string =>
	`👊 Fighter Passive — Bash! Stunned for ${stunTurns} turn and left Dizzy.`;
export const COMBAT_MAGE_OVERCHARGE = (debuffName: string): string =>
	`🔮 Mage Passive: Overcharge — nuke landed, applying ${debuffName}.`;
export const COMBAT_KNIGHT_REGEN = (restored: string): string => `🛡️ Knight Passive: Restored ${restored} HP.`;
export const COMBAT_ARCHER_DOUBLE_ATTACK = '🏹 Archer Passive — Double Attack!';

// --- Rune decorator ---
export const COMBAT_RUNE_VAMPIRIC = (healed: string): string => `🩸 Vampiric Rune — lifesteal ${healed} HP.`;
export const COMBAT_RUNE_VENOM = (value: string): string => `☠️ Venom Rune — applied Poison (${value}/turn).`;
export const COMBAT_RUNE_THORNS = (reflected: string): string => `🌵 Thorns Rune — reflected ${reflected} damage back.`;
