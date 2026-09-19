import type { CombatClass } from '../entities/PlayerAccount.js';

export type DebuffTag = 'bleed' | 'burn' | 'venom' | 'atk_down' | 'def_down' | 'paralyze' | 'stun' | 'dizzy' | 'blight';

/**
 * A status effect on one side. `value` means different things per tag:
 *  - bleed/burn: flat damage dealt at end-of-round tick
 *  - atk_down/def_down: fractional reduction (0.15 = -15%)
 *  - paralyze/stun/dizzy: presence alone matters, `value` unused
 */
export interface Debuff {
	tag: DebuffTag;
	turnsLeft: number;
	value: number;
	stacks?: number;
}

/** One combatant's mutable state for the duration of a single battle. */
export interface CombatantState {
	name: string;
	/** Emoji hiển thị trước tên trong battle log (VD: 🐅 cho mob) — tuỳ chọn. */
	emoji?: string;
	combatClass: CombatClass | null; // null for mobs — mobs get the no-op strategy
	hp: number;
	maxHp: number;
	atk: number;
	def: number;
	crit: number; // percent, e.g. 5 means 5%
	debuffs: Debuff[];
	immunityTags?: string[];
	/** Free-form per-battle scratch space for a class strategy (e.g. Swordsman's ATK-stack %, Mage's overcharge charge counter). */
	flags: Record<string, number | boolean>;
}

export function findDebuff(side: CombatantState, tag: DebuffTag): Debuff | undefined {
	return side.debuffs.find((d) => d.tag === tag);
}

export function hasDebuff(side: CombatantState, tag: DebuffTag): boolean {
	return findDebuff(side, tag) !== undefined;
}

/** `🐅 Tiger` — tên kèm emoji (nếu có) để log dễ đọc. */
export function combatDisplayName(c: CombatantState): string {
	return c.emoji ? `${c.emoji} ${c.name}` : c.name;
}

export function createCombatant(params: {
	name: string;
	combatClass: CombatClass | null;
	hp: number;
	atk: number;
	def: number;
	crit: number;
	emoji?: string;
}): CombatantState {
	return {
		name: params.name,
		emoji: params.emoji,
		combatClass: params.combatClass,
		hp: params.hp,
		maxHp: params.hp,
		atk: params.atk,
		def: params.def,
		crit: params.crit,
		debuffs: [],
		flags: {},
	};
}
