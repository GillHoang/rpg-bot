import type { CombatClass } from '../../identity/domain/PlayerAccount.js';
import { COMBAT_STRIKE_EMOJIS, COMBAT_TENACITY_SHRUG } from '../../../shared/ui/text/combat.js';
import { rollChance } from '../../../shared/utils/weightedRandom.js';

export type DebuffTag =
	'bleed' | 'burn' | 'venom' | 'atk_down' | 'def_down' | 'paralyze' | 'stun' | 'dizzy' | 'blight' | 'slow';

/**
 * A status effect on one side. `value` means different things per tag:
 *  - bleed/burn: flat damage dealt at end-of-round tick
 *  - atk_down/def_down: fractional reduction (0.15 = -15%)
 *  - paralyze/stun/dizzy: presence alone matters, `value` unused
 *  - slow: fractional SPD penalty (0.25 = -25% effective SPD)
 */
export interface Debuff {
	tag: DebuffTag;
	turnsLeft: number;
	value: number;
	stacks?: number;
}

/** Tags whose application Tenacity can shrug off entirely. */
const HARD_CC_TAGS: ReadonlySet<DebuffTag> = new Set(['stun', 'paralyze', 'dizzy']);

/**
 * Single choke point for applying a debuff. Tenacity gives a flat chance
 * to shrug off incoming hard CC (stun/paralyze/dizzy); DOT/fractional tags
 * pass through unchanged. Returns the applied debuff, or null on a shrug.
 *
 * Fractional tags (atk_down/def_down/slow) share one slot per tag: a
 * re-proc keeps the strongest value and refreshes the duration, so repeat
 * procs (e.g. wing_clippers) extend pressure instead of stacking dead rows
 * that findDebuff() would never read.
 */
export function applyDebuff(
	target: CombatantState,
	debuff: { tag: DebuffTag; turnsLeft: number; value: number; stacks?: number },
	rng: () => number,
	log?: (message: string) => void,
): Debuff | null {
	if (HARD_CC_TAGS.has(debuff.tag)) {
		const ten = target.ten ?? 0;
		if (ten > 0 && rollChance(ten / 100, rng)) {
			log?.(COMBAT_TENACITY_SHRUG(combatDisplayName(target)));
			return null;
		}
	}
	if (debuff.tag === 'atk_down' || debuff.tag === 'def_down' || debuff.tag === 'slow') {
		const existing = target.debuffs.find((d) => d.tag === debuff.tag);
		if (existing) {
			existing.value = Math.max(existing.value, debuff.value);
			existing.turnsLeft = Math.max(existing.turnsLeft, debuff.turnsLeft);
			return existing;
		}
	}
	const applied: Debuff = { tag: debuff.tag, turnsLeft: debuff.turnsLeft, value: debuff.value };
	if (debuff.stacks !== undefined) applied.stacks = debuff.stacks;
	target.debuffs.push(applied);
	return applied;
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
	/** Speed: higher acts first each round (ties fall back to the initiative roll). */
	spd: number;
	/** Accuracy points vs the defender's evasion (see rollHit). */
	acc: number;
	/** Evasion points vs the attacker's accuracy (see rollHit). */
	eva: number;
	/** Tenacity: % chance to shrug off incoming stun/paralyze/dizzy entirely (see applyDebuff). */
	ten: number;
	debuffs: Debuff[];
	immunityTags?: string[];
	/** Free-form per-battle scratch space for a class strategy (e.g. Swordsman's ATK-stack %, Mage's overcharge charge counter). */
	flags: Record<string, number | boolean>;
}

export function findDebuff(side: CombatantState, tag: DebuffTag): Debuff | undefined {
	return side.debuffs.find((d) => d.tag === tag);
}

/** SPD after the slow snare (if any). Used by turn order. */
export function effectiveSpd(side: CombatantState): number {
	const slow = findDebuff(side, 'slow')?.value ?? 0;
	return side.spd * (1 - Math.min(0.9, Math.max(0, slow)));
}

/** P8 heal cap: all healing shares one per-round budget (8% max HP). */
export const HEAL_CAP_PCT = 0.08;

/** P8 immunity budget shared by aegis/lunar-veil/sky-sovereign: the first
 * two full nullifies per battle apply in full; further ones halve
 * (0.5) instead of nullifying. */
export const IMMUNITY_BUDGET = 2;

export function immunityMultiplier(side: CombatantState): number {
	const used = (side.flags.immunity_used as number) ?? 0;
	side.flags.immunity_used = used + 1;
	return used < IMMUNITY_BUDGET ? 1 : 0.5;
}

/**
 * Heal through the shared per-round budget. Diversified sustain
 * (lifesteal + regen + blessings) stacks, but never out-heals the cap.
 */
export function cappedHeal(side: CombatantState, amount: number): number {
	if (amount <= 0 || side.hp <= 0) return 0;
	const budget = Math.floor(side.maxHp * HEAL_CAP_PCT) - ((side.flags.healed_this_round as number) ?? 0);
	const healed = Math.max(0, Math.min(amount, budget, side.maxHp - side.hp));
	if (healed > 0) {
		side.hp += healed;
		side.flags.healed_this_round = ((side.flags.healed_this_round as number) ?? 0) + healed;
	}
	return healed;
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
	spd?: number;
	acc?: number;
	eva?: number;
	ten?: number;
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
		spd: params.spd ?? 100,
		acc: params.acc ?? 0,
		eva: params.eva ?? 0,
		ten: params.ten ?? 0,
		debuffs: [],
		flags: {},
	};
}
