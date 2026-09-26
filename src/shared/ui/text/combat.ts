/**
 * Text battle log hiển thị trong output của /raid, format tag kiểu:
 *   [   PHYS] 🐅 tiger đánh okbroomer, gây 95 HP
 *   [ LIFEST] 🩸 gdeer hút 79 HP
 * Tag được pad cố định 8 ký tự để thẳng cột trong codeblock Discord.
 * Tên riêng (blessing, rune, hiệu lực như Dizzy/CRIT/HP) giữ nguyên.
 * Icon nằm trong src/shared/ui/text/icons.ts — không viết unicode literal tại đây.
 */
import { ICONS } from './icons.js';

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
	MISS: '  MISS',
	FRENZY: 'FRENZY',
	ECLIPS: 'ECLIPS',
} as const;

// --- Emoji đòn đánh ---
/**
 * Emoji đứng trước tên attacker trong đòn đánh thường: tay không dùng
 * `bareHand`, combatant cầm vũ khí có emoji riêng thì services gán
 * `attackEmoji` khi dựng CombatantState. `crit` là emoji toàn cục, đè lên
 * emoji vũ khí khi chí mạng.
 */
export const COMBAT_STRIKE_EMOJIS = {
	bareHand: ICONS.strike.bareHand,
	crit: ICONS.strike.crit,
} as const;

export const COMBAT_ROUND_HEADER = (round: number): string => `— Hiệp ${round} —`;
export const COMBAT_SUDDEN_DEATH_HEADER = (multiplier: number): string =>
	`${ICONS.effect.suddenDeath} TỬ CHIẾN — huyết nguyệt lên: sát thương nhân x${multiplier}, hai bên mất 2% HP tối đa mỗi hiệp!`;

export const COMBAT_BLOOD_MOON = (name: string, amount: string): string =>
	`${combatTag(COMBAT_TAGS.ECLIPS)} Huyết nguyệt rút của ${name} __${amount} HP__.`;

/** Phase 4 weekly modifier announcement, prepended to hunt battle logs. */
export const COMBAT_WEEKLY_MODIFIER = (name: string, desc: string): string =>
	`${ICONS.quest.weeklyHeader} Tuần này: **${name}** — ${desc}`;

export const COMBAT_DEFEATED_SUFFIX = (name: string): string => ` — ${name} gục ngã!`;

export const COMBAT_HIT = (
	tag: string,
	strikeEmoji: string,
	attacker: string,
	defender: string,
	dealt: string,
	defeatedSuffix: string,
): string => `${combatTag(tag)} ${strikeEmoji} ${attacker} đánh ${defender}, gây __${dealt} HP__.${defeatedSuffix}`;

export const COMBAT_MISS = (attacker: string, defender: string): string =>
	`${combatTag(COMBAT_TAGS.MISS)} ${attacker} đánh hụt ${defender}!`;

export const COMBAT_GUARD = (defender: string, pct: number): string =>
	`${combatTag(COMBAT_TAGS.GUARD)} ${defender} chặn __${pct}%__ sát thương.`;

export const COMBAT_DOT_TICK = (tag: string, name: string, tick: string, label: string): string =>
	`${combatTag(tag)} ${name} trừ __${tick} HP__ (${label}).`;

// --- Trạng thái hành động ---
export const COMBAT_UNABLE_TO_ACT = (name: string): string =>
	`${combatTag(COMBAT_TAGS.STUNN)} ${name} không thể hành động trong lượt này.`;
export const COMBAT_ATTACK_MISSES_DIZZY = (name: string): string =>
	`${combatTag(COMBAT_TAGS.DIZZY)} Đòn đánh của ${name} bị trượt (Dizzy)!`;
export const COMBAT_TENACITY_SHRUG = (name: string): string =>
	`${combatTag(COMBAT_TAGS.GUARD)} ${name} gồng mình kháng hiệu ứng khống chế!`;

// --- Nội tại class ---
export const COMBAT_SWORDSMAN_ATK_UP = (name: string, pct: number): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${ICONS.combatClass.swordsman} ${name} tăng ${pct}% ATK (tích luỹ).`;
export const COMBAT_SWORDSMAN_BLEED = (
	name: string,
	enemy: string,
	stacks: number,
	maxStacks: number,
	pct: number,
): string =>
	`${combatTag(COMBAT_TAGS.BLEED)} ${ICONS.combatClass.swordsman} ${name} áp Chảy máu lên ${enemy} (cột ${stacks}/${maxStacks}, ${pct}% ATK mỗi lượt).`;
export const COMBAT_FIGHTER_BASH = (name: string, enemy: string, stunTurns: number): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${ICONS.strike.bareHand} ${name} Bash ${enemy} — choáng ${stunTurns} lượt và để đối thủ Dizzy.`;
export const COMBAT_MAGE_OVERCHARGE = (name: string, debuffName: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${ICONS.combatClass.mage} ${name} Quá Tải — áp hiệu ${debuffName}.`;
export const COMBAT_KNIGHT_REGEN = (name: string, restored: string): string =>
	`${combatTag(COMBAT_TAGS.REGEN)} ${ICONS.combatClass.knight} ${name} hồi __${restored} HP__.`;
export const COMBAT_ARCHER_DOUBLE_ATTACK = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${ICONS.combatClass.archer} ${name} kích hoạt Đánh Đôi!`;
export const COMBAT_ARCHER_AIMED = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${ICONS.combatClass.archer} ${name} ngắm bắn — xuyên sâu, chắc tay!`;
export const COMBAT_SWORDSMAN_DETONATE = (name: string, enemy: string, amount: string): string =>
	`${combatTag(COMBAT_TAGS.BLEED)} ${ICONS.combatClass.swordsman} ${name} kích nổ Chảy máu trên ${enemy}, gây thêm __${amount} HP__!`;
export const COMBAT_MAGE_WEAVE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${ICONS.combatClass.mage} ${name} dệt phép — Quá Tải cực đại!`;
export const COMBAT_KNIGHT_BULWARK = (name: string): string =>
	`${combatTag(COMBAT_TAGS.GUARD)} ${ICONS.combatClass.knight} ${name} dựng khiên Bulwark!`;
export const COMBAT_KNIGHT_SECOND_WIND = (name: string): string =>
	`${combatTag(COMBAT_TAGS.GUARD)} ${ICONS.combatClass.knight} ${name} gồng mình — xóa mọi hiệu ứng xấu!`;

// --- Rune decorator ---
export const COMBAT_RUNE_VAMPIRIC = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.LIFEST)} ${ICONS.effect.lifesteal} ${name} hút __${healed} HP__.`;
export const COMBAT_RUNE_VENOM = (name: string, enemy: string, value: string): string =>
	`${combatTag(COMBAT_TAGS.VENM)} ${ICONS.effect.venom} ${name} nhiễm độc ${enemy} (${value} HP mỗi lượt).`;
export const COMBAT_RUNE_THORNS = (name: string, reflected: string): string =>
	`${combatTag(COMBAT_TAGS.THORN)} ${ICONS.effect.thorns} ${name} phản lại __${reflected} HP__.`;
export const COMBAT_FROST = (name: string, enemy: string): string =>
	`${combatTag(COMBAT_TAGS.DIZZY)} ${name} làm ${enemy} chậm chạp (−SPD 1 lượt)!`;

// --- Deity blessing decorator ---
export const COMBAT_BLESSING_GUARDIAN_LIGHT = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.REGEN)} ${ICONS.blessing.guardianLight} Guardian Light — ${name} hồi __${healed} HP__.`;
export const COMBAT_BLESSING_TAILWIND = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ${ICONS.blessing.tailwind} Tailwind — ${name} có lợi thế ra đòn trước.`;
export const COMBAT_BLESSING_TIDAL_WRATH = (name: string, bonus: number): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ${ICONS.blessing.tidalWrath} Tidal Wrath — ${name} +${bonus}% sát thương khi máu cạn.`;
export const COMBAT_BLESSING_MOON_DEVOURER = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ${ICONS.blessing.moonDevourer} Moon Devourer — ${name} nuốt trăng, đòn đánh nặng gấp đôi!`;
export const COMBAT_BLESSING_LUNAR_VEIL = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ${ICONS.blessing.lunarVeil} Lunar Veil — sát thương đòn kế tiếp vào ${name} bị giảm.`;
export const COMBAT_BLESSING_SOLAR_FURY = (name: string, bonus: number): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ${ICONS.blessing.solarFury} Solar Fury — ${name} +${bonus}% sát thương mỗi đòn.`;
export const COMBAT_BLESSING_MOUNTAIN_GRACE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ${ICONS.blessing.mountainGrace} Mountain Grace — ${name} vào thế phòng thủ.`;
export const COMBAT_BLESSING_SKY_SOVEREIGN = (name: string): string =>
	`${combatTag(COMBAT_TAGS.AEGIS)} ${ICONS.blessing.skySovereign} Sky Sovereign — thiên lệnh hoá giải trọn vẹn đòn đánh vào ${name}!`;

// --- Weapon passive decorator (OwO-style weapon passives) ---
export const COMBAT_WEAPON_FIRST_BLOOD = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} ra tay trước — đòn đầu +10% sát thương!`;
export const COMBAT_WEAPON_WARLORD_EDGE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} lấn lướt kẻ mạnh hơn — +5% sát thương!`;
export const COMBAT_WEAPON_SKY_DIVE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} bổ nhào từ toàn vẹn — chí mạng tăng!`;
export const COMBAT_WEAPON_ECLIPSE_MARK = (name: string, enemy: string): string =>
	`${combatTag(COMBAT_TAGS.ECLIPS)} ${name} khắc nhật thực lên ${enemy} — nhận thêm 15% sát thương!`;
export const COMBAT_WEAPON_EAGLE_DIVE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} lao xuống như đại bàng — +10% sát thương hiệp đầu!`;
export const COMBAT_WEAPON_TWIN_STING = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} đâm bồi bằng mũi thứ hai!`;
export const COMBAT_WEAPON_STORM_ECHO = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} dội sấm hưởng — +25% sát thương!`;
export const COMBAT_WEAPON_SOUL_WEIGH = (name: string, bonus: number): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} cân hồn đối thủ — +${bonus}% sát thương kết liễu!`;
export const COMBAT_WEAPON_GRASS_CLEAVER = (name: string, enemy: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} phạt cỏ — giáp ${enemy} nứt vỡ!`;
export const COMBAT_WEAPON_OATH_PIERCE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} giữ lời thề — đòn đánh xuyên giáp!`;
export const COMBAT_WEAPON_SOLAR_BARQUE = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.REGEN)} ${name} dong thuyền mặt trời — hồi __${healed} HP__.`;
export const COMBAT_WEAPON_SKY_SUNDER = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} chẻ toang bầu trời — +15% sát thương!`;

// --- Monster skills ---
export const COMBAT_MONSTER_ECLIPSE = (): string =>
	`${combatTag(COMBAT_TAGS.ECLIPS)} ${ICONS.effect.eclipse} Bakunawa bước vào Eclipse — sát thương +50%.`;
export const COMBAT_MONSTER_PHASE_TWO = (name: string): string =>
	`${combatTag(COMBAT_TAGS.ECLIPS)} ${ICONS.effect.eclipse} ${name} chuyển pha — vảy trăng rực sáng!`;
export const COMBAT_MONSTER_PHASE_THREE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.FRENZY)} ${ICONS.effect.frenzy} ${name} cuồng nộ tột cùng — sát thương +80%!`;
export const COMBAT_MONSTER_SHED = (name: string): string =>
	`${combatTag(COMBAT_TAGS.GUARD)} ${name} rũ bỏ mọi hiệu ứng chảy máu/độc!`;
export const COMBAT_MONSTER_DEVOUR_CHARGE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} đang tụ lực cho đòn kết liễu…`;
export const COMBAT_MONSTER_HEAVY = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} tung đòn nặng — đỡ đòn!`;
export const COMBAT_MONSTER_DEVOUR = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${ICONS.effect.feast} ${name} NGOẠM — đòn hủy diệt!`;
export const COMBAT_MONSTER_LEAP = (name: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} vồ từ huyết nguyệt xuống!`;
export const COMBAT_MONSTER_CLIPPERS = (name: string, enemy: string): string =>
	`${combatTag(COMBAT_TAGS.SKILL)} ${name} xé tay ${enemy} — ATK giảm!`;
export const COMBAT_MONSTER_HAZE = (name: string, enemy: string): string =>
	`${combatTag(COMBAT_TAGS.DIZZY)} Sương mù của ${name} làm ${enemy} choáng váng!`;
export const COMBAT_MONSTER_SMOKE = (name: string, enemy: string): string =>
	`${combatTag(COMBAT_TAGS.BURN)} Khói xì gà của ${name} bóp nghẹt hồi phục của ${enemy}!`;
export const COMBAT_MONSTER_REGEN = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.REGEN)} ${name} hồi __${healed} HP__ qua từng hiệp.`;
export const COMBAT_MONSTER_BERSERK = (name: string, price: string): string =>
	`${combatTag(COMBAT_TAGS.FRENZY)} ${name} đốt __${price} HP__ lấy sức mạnh!`;
export const COMBAT_MONSTER_DRAIN = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.LIFEST)} ${ICONS.effect.feast} ${name} hút __${healed} HP__ từ đòn đánh!`;
export const COMBAT_MONSTER_ENRAGE = (name: string): string =>
	`${combatTag(COMBAT_TAGS.FRENZY)} ${name} cuồng nộ — sát thương tăng mạnh khi yếu máu!`;
export const COMBAT_MONSTER_REFLECT = (name: string, enemy: string, reflected: string): string =>
	`${combatTag(COMBAT_TAGS.THORN)} ${ICONS.effect.thorns} ${name} phản lại __${reflected} HP__ vào ${enemy}!`;
export const COMBAT_MONSTER_SHIELDED = (name: string, amount: string): string =>
	`${combatTag(COMBAT_TAGS.GUARD)} ${name} dựng khiên __${amount} HP__ mở đầu trận!`;
export const COMBAT_MONSTER_SWIFT = (name: string): string =>
	`${combatTag(COMBAT_TAGS.BLESS)} ${name} nhanh như chớp — luôn tranh lượt trước!`;
export const COMBAT_MONSTER_FRENZY = (name: string): string =>
	`${combatTag(COMBAT_TAGS.FRENZY)} ${ICONS.effect.frenzy} ${name} cuồng nộ — sát thương +40%.`;
export const COMBAT_MONSTER_FEAST = (name: string, healed: string): string =>
	`${combatTag(COMBAT_TAGS.LIFEST)} ${ICONS.effect.feast} ${name} tấn __${healed} HP__.`;
export const COMBAT_MONSTER_VENOM_SPIT = (name: string, enemy: string, value: string): string =>
	`${combatTag(COMBAT_TAGS.VENM)} ${ICONS.effect.venom} ${name} phun nọc vào ${enemy} (${value} HP mỗi lượt).`;

/** Display text for domain/combat/CombatStatusEffects. */
export const COMBAT_DOT_LABELS = {
	bleed: 'Chảy máu',
	burn: 'Bỏng',
	venom: 'Nhiễm độc',
};
