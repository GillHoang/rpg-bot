/**
 * Skill system config — Phase 2 (battle-upgrade-plan.md §Trục B).
 *
 * Mỗi class có 4 skill; người chơi mang tối đa 2 vào trận (skill_slot_1/2).
 * Skill tốn resource + cooldown theo lượt; Battle Order (stance) quyết định
 * quy tắc chọn skill khi nhiều skill sẵn sàng. Đây là dữ liệu thuần —
 * effect thực thi nằm ở domain/skillEffects.ts (OCP: thêm skill = thêm
 * entry + def, không sửa decorator/engine).
 *
 * Cân bằng: cost 20–50 trên resource tối đa 100; cooldown 2–5 round. Không
 * skill nào one-shot: burst mạnh nhất cũng chỉ là rider cộng thêm, vẫn đi
 * qua mitigation/pierce-cap/crit-cap như đòn thường.
 */

export type BattleStance = 'aggressive' | 'balanced' | 'defensive' | 'counter';
export const BATTLE_STANCES: readonly BattleStance[] = ['aggressive', 'balanced', 'defensive', 'counter'];
export const DEFAULT_BATTLE_STANCE: BattleStance = 'balanced';

/** Skill families by role: burst (đắt, dứt điểm) · pressure (rẻ, bào mòn) · sustain (hồi/phòng) · control (khống chế). */
export type SkillKind = 'burst' | 'pressure' | 'sustain' | 'control';

export interface SkillDef {
	key: string;
	combatClass: string;
	kind: SkillKind;
	/** Resource tiêu khi cast (0–100). */
	cost: number;
	/** Số round chờ sau khi cast. */
	cooldown: number;
}

/** Tối đa 2 skill mang vào trận. */
export const MAX_EQUIPPED_SKILLS = 2;

/** Resource (nộ/khí/mana — gọi chung): tích khi gây/nhận damage, tiêu khi cast. */
export const SKILL_RESOURCE = {
	max: 100,
	/** Resource nhận khi gây damage (đòn trúng, damage > 0). */
	gainDealt: 12,
	/** Resource nhận khi nhận damage. */
	gainTaken: 8,
} as const;

export const SKILL_DEFS: Readonly<Record<string, SkillDef>> = {
	// ── Swordsman ──
	rend: { key: 'rend', combatClass: 'Swordsman', kind: 'pressure', cost: 25, cooldown: 3 },
	warcry: { key: 'warcry', combatClass: 'Swordsman', kind: 'sustain', cost: 30, cooldown: 4 },
	execute: { key: 'execute', combatClass: 'Swordsman', kind: 'burst', cost: 50, cooldown: 5 },
	bloodlust: { key: 'bloodlust', combatClass: 'Swordsman', kind: 'pressure', cost: 20, cooldown: 2 },
	// ── Fighter ──
	sunder: { key: 'sunder', combatClass: 'Fighter', kind: 'pressure', cost: 25, cooldown: 3 },
	frenzy: { key: 'frenzy', combatClass: 'Fighter', kind: 'burst', cost: 45, cooldown: 5 },
	stomp: { key: 'stomp', combatClass: 'Fighter', kind: 'control', cost: 30, cooldown: 4 },
	bloodboil: { key: 'bloodboil', combatClass: 'Fighter', kind: 'sustain', cost: 35, cooldown: 5 },
	// ── Mage ──
	fireball: { key: 'fireball', combatClass: 'Mage', kind: 'burst', cost: 40, cooldown: 4 },
	frostbolt: { key: 'frostbolt', combatClass: 'Mage', kind: 'control', cost: 25, cooldown: 3 },
	surge: { key: 'surge', combatClass: 'Mage', kind: 'burst', cost: 50, cooldown: 5 },
	manashield: { key: 'manashield', combatClass: 'Mage', kind: 'sustain', cost: 30, cooldown: 4 },
	// ── Knight ──
	smite: { key: 'smite', combatClass: 'Knight', kind: 'pressure', cost: 25, cooldown: 3 },
	rally: { key: 'rally', combatClass: 'Knight', kind: 'sustain', cost: 35, cooldown: 5 },
	aegiswall: { key: 'aegiswall', combatClass: 'Knight', kind: 'sustain', cost: 30, cooldown: 4 },
	retribution: { key: 'retribution', combatClass: 'Knight', kind: 'burst', cost: 45, cooldown: 5 },
	// ── Archer ──
	aimed: { key: 'aimed', combatClass: 'Archer', kind: 'pressure', cost: 20, cooldown: 2 },
	volley: { key: 'volley', combatClass: 'Archer', kind: 'burst', cost: 45, cooldown: 5 },
	snare: { key: 'snare', combatClass: 'Archer', kind: 'control', cost: 25, cooldown: 3 },
	fielddressing: { key: 'fielddressing', combatClass: 'Archer', kind: 'sustain', cost: 30, cooldown: 4 },
};

export interface ReadySkill {
	key: string;
	cost: number;
	kind: SkillKind;
}

/**
 * Quy tắc chọn skill theo Battle Order (deterministic — KHÔNG roll RNG để
 * RNG stream của trận không đổi khi không có skill). `skills` đã lọc sẵn
 * sàng + đủ resource (do engine chuẩn bị).
 */
export function chooseSkillByStance(skills: readonly ReadySkill[], stance: BattleStance): string | null {
	if (!skills.length) return null;
	const byCostDesc = [...skills].sort((a, b) => b.cost - a.cost || (a.key < b.key ? -1 : 1));
	const byCostAsc = [...byCostDesc].reverse();
	switch (stance) {
		case 'aggressive':
			return byCostDesc[0]!.key;
		case 'balanced':
			return byCostAsc[0]!.key;
		case 'defensive': {
			const sustain = byCostAsc.find((s) => s.kind === 'sustain');
			return sustain?.key ?? null;
		}
		case 'counter': {
			const control = byCostAsc.find((s) => s.kind === 'control');
			return control?.key ?? null;
		}
	}
}

/** Mọi skill key của một class (cho UI list + validation equip). */
export function skillsForClass(combatClass: string): SkillDef[] {
	return Object.values(SKILL_DEFS).filter((def) => def.combatClass === combatClass);
}
