import { formatNumber } from '../../../shared/ui/text/format.js';
import {
	COMBAT_DOT_LABELS,
	COMBAT_ATTACK_MISSES_DIZZY,
	COMBAT_DOT_TICK,
	COMBAT_TAGS,
	COMBAT_UNABLE_TO_ACT,
} from '../../../shared/ui/text/combat.js';
import { rollChance } from '../../../shared/utils/weightedRandom.js';
import type { CombatantState, Debuff } from './CombatantState.js';
import { combatDisplayName, findDebuff } from './CombatantState.js';

export interface ICombatStatusEffects {
	removeImmuneDebuffs(side: CombatantState): void;
	isTurnDisabled(side: CombatantState, rng: () => number, log: string[]): boolean;
	applyEndOfRoundEffects(side: CombatantState, existingDebuffs: Set<Debuff>, log: string[]): void;
}

/** Status lifecycle policy; every mutation belongs to the passed battle state. */
export class CombatStatusEffectProcessor implements ICombatStatusEffects {
	/** Remove immune effects; the legacy poison immunity also covers venom. */
	removeImmuneDebuffs(attacker: CombatantState): void {
		const immunities = attacker.immunityTags;
		if (!immunities) return;
		attacker.debuffs = attacker.debuffs.filter(
			(d) => !immunities.includes(d.tag) && !(d.tag === 'venom' && immunities.includes('poison')),
		);
	}

	/** Hard CC (stun/paralyze) skips the turn; Dizzy consumes itself on a miss roll. */
	isTurnDisabled(attacker: CombatantState, rng: () => number, log: string[]): boolean {
		// Hard crowd-control: skip the action entirely.
		if (findDebuff(attacker, 'stun') || findDebuff(attacker, 'paralyze')) {
			log.push(COMBAT_UNABLE_TO_ACT(combatDisplayName(attacker)));
			return true;
		}
		// Dizzy: single-use miss chance on the next attack, consumed either way.
		const dizzy = findDebuff(attacker, 'dizzy');
		if (!dizzy) return false;
		attacker.debuffs = attacker.debuffs.filter((d) => d !== dizzy);
		if (rollChance(dizzy.value, rng)) {
			log.push(COMBAT_ATTACK_MISSES_DIZZY(combatDisplayName(attacker)));
			return true;
		}
		return false;
	}

	/** Apply status bookkeeping before the surviving combatant's round-end hook. */
	applyEndOfRoundEffects(side: CombatantState, existingDebuffs: Set<Debuff>, log: string[]): void {
		this.removeImmuneDebuffs(side);
		this.tickDamageOverTime(side, log);
		this.tickStatusDurations(side, existingDebuffs);
		side.debuffs = side.debuffs.filter((debuff) => debuff.turnsLeft > 0);
	}

	/** DOT ticks (bleed, burn, venom), reduced by the target's Warding rune (if any). */
	private tickDamageOverTime(side: CombatantState, log: string[]): void {
		const wardingPct = (side.flags.warding_pct as number) ?? 0;
		for (const debuff of side.debuffs) {
			if (!isDotTag(debuff.tag)) continue;
			const tick = Math.floor(debuff.value * (1 - wardingPct));
			debuff.turnsLeft -= 1;
			if (tick <= 0) continue;
			side.hp = Math.max(0, side.hp - tick);
			log.push(
				COMBAT_DOT_TICK(
					dotTagOf(debuff.tag),
					combatDisplayName(side),
					formatNumber(tick),
					dotLabelOf(debuff.tag),
				),
			);
		}
	}

	/**
	 * Non-DOT status durations tick down too (stun/paralyze/atk_down/def_down/blight),
	 * except ones added during the turns — those start counting next round.
	 */
	private tickStatusDurations(side: CombatantState, existingDebuffs: Set<Debuff>): void {
		for (const debuff of side.debuffs) {
			if (isDotTag(debuff.tag) || !existingDebuffs.has(debuff)) continue;
			debuff.turnsLeft -= 1;
		}
	}
}

const DOT_TAGS = ['bleed', 'burn', 'venom'] as const;
type DotTag = (typeof DOT_TAGS)[number];

const isDotTag = (tag: string): tag is DotTag => DOT_TAGS.includes(tag as DotTag);

function dotTagOf(tag: DotTag): string {
	switch (tag) {
		case 'bleed':
			return COMBAT_TAGS.BLEED;
		case 'burn':
			return COMBAT_TAGS.BURN;
		default:
			return COMBAT_TAGS.VENM;
	}
}

function dotLabelOf(tag: DotTag): string {
	switch (tag) {
		case 'bleed':
			return COMBAT_DOT_LABELS.bleed;
		case 'burn':
			return COMBAT_DOT_LABELS.burn;
		default:
			return COMBAT_DOT_LABELS.venom;
	}
}
