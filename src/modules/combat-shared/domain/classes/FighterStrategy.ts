import { rollChance } from '../../../../shared/utils/weightedRandom.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { combatDisplayName, findDebuff } from '../CombatantState.js';
import { COMBAT_FIGHTER_BASH } from '../../../../shared/ui/text/combat.js';

const DAMAGE_BONUS_PCT = 50;
const STUN_CHANCE = 0.3;
const STUN_TURNS = 1;
const BASH_DAMAGE_BONUS_PCT = 50; // additional, on top of DAMAGE_BONUS_PCT, when a Bash procs
const DIZZY_MISS_CHANCE = 0.15;

/**
 * Passive: Stun — ported from config/classes.js CLASS_PASSIVE_VALUES.Fighter.
 * All attacks carry +50% damage. Each attack additionally has a 30%
 * chance to become a "Bash": +50% more damage (so +100% total), Stun the
 * target for 1 round, and leave it Dizzy (15% chance to miss its next attack).
 *
 * Not ported (item/rune-system dependent, out of scope for the core class
 * passive): Jarngreipr's extra Bash rider, stun-lock immunity windows.
 */
export class FighterStrategy extends NullClassStrategy {
	override readonly key = 'Fighter' as const;

	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		hit.damagePctBonus += DAMAGE_BONUS_PCT;

		const willBash = rollChance(STUN_CHANCE, ctx.rng) && !findDebuff(ctx.enemy, 'stun');
		ctx.self.flags.fighter_bash_this_hit = willBash;
		if (willBash) hit.damagePctBonus += BASH_DAMAGE_BONUS_PCT;
	}

	override onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		if (!ctx.self.flags.fighter_bash_this_hit || resolved.damageDealt <= 0) return;
		ctx.self.flags.fighter_bash_this_hit = false;

		ctx.enemy.debuffs.push(
			{ tag: 'stun', turnsLeft: STUN_TURNS, value: 0 },
			// Keep the next-attack rider alive through the stunned round.
			{ tag: 'dizzy', turnsLeft: STUN_TURNS + 1, value: DIZZY_MISS_CHANCE },
		);
		ctx.log(COMBAT_FIGHTER_BASH(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy), STUN_TURNS));
	}
}
