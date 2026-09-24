import type { CombatClass } from '../../identity/domain/PlayerAccount.js';
import { COMBAT_STRIKE_EMOJIS } from '../../../shared/ui/text/combat.js';

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
	/**
	 * Emoji vũ khí hiển thị trong đòn đánh thường; CRIT dùng emoji toàn cục.
	 * Mặc định tay không (createCombatant tự điền) — services gán khi đọc
	 * vũ khí đang equip của người chơi, ví dụ từ cột emoji của weapon_roster.
	 */
	attackEmoji?: string;
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

/** ``🐅 Tiger`` — tên dạng inline code: username chứa __ không vỡ markdown Discord. */
export function combatDisplayName(c: CombatantState): string {
	return c.emoji ? `\`${c.emoji} ${c.name}\`` : `\`${c.name}\``;
}

export function createCombatant(params: {
	name: string;
	combatClass: CombatClass | null;
	hp: number;
	atk: number;
	def: number;
	crit: number;
	emoji?: string;
	attackEmoji?: string;
}): CombatantState {
	return {
		name: params.name,
		emoji: params.emoji,
		attackEmoji: params.attackEmoji ?? COMBAT_STRIKE_EMOJIS.bareHand,
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
