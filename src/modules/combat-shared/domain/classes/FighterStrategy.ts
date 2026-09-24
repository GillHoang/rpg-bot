import { rollChance } from '../../../../shared/utils/weightedRandom.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { applyDebuff, combatDisplayName, findDebuff } from '../CombatantState.js';
import { COMBAT_FIGHTER_BASH } from '../../../../shared/ui/text/combat.js';

const DAMAGE_BONUS_PCT = 40;
const BASE_BASH_CHANCE = 0.15;
const DIZZY_BASH_CHANCE = 0.35;
const BASH_DAMAGE_BONUS_PCT = 50; // additional, on top of DAMAGE_BONUS_PCT, when a Bash procs
const DIZZY_MISS_CHANCE = 0.15;

/**
 * Passive: Stun — ported from config/classes.js CLASS_PASSIVE_VALUES.Fighter.
 * All attacks carry +50% damage. Each attack can become a "Bash": +50% more
 * damage (so +100% total), Stun the target, and leave it Dizzy (15% miss on
 * its next attack). Bash is conditional pressure, not flat RNG: 25% base,
 * 50% against an already-Dizzy target, never against a stunned one
 * (no stun-lock). Bashing a target below 30% HP stuns for 2 rounds
 * (execution) instead of 1.
 */
export class FighterStrategy extends NullClassStrategy {
	override readonly key = 'Fighter' as const;

	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		hit.damagePctBonus += DAMAGE_BONUS_PCT;

		// No stun-lock: a target stunned within the last 2 rounds cannot be
		// bashed again until the immunity window lapses.
		const warded = ((ctx.enemy.flags.stun_immune_until as number) ?? 0) >= ctx.round;
		const dizzy = !!findDebuff(ctx.enemy, 'dizzy');
		const chance = dizzy ? DIZZY_BASH_CHANCE : BASE_BASH_CHANCE;
		const willBash = !warded && rollChance(chance, ctx.rng) && !findDebuff(ctx.enemy, 'stun');
		ctx.self.flags.fighter_bash_this_hit = willBash;
		if (willBash) hit.damagePctBonus += BASH_DAMAGE_BONUS_PCT;
	}

	override onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		// Consume the bash flag on every landed hit (a miss must not leave a
		// stale flag that stuns on a later, non-bash hit).
		const bashed = ctx.self.flags.fighter_bash_this_hit === true;
		ctx.self.flags.fighter_bash_this_hit = false;
		if (!bashed || resolved.damageDealt <= 0) return;

		const execution = ctx.enemy.hp < ctx.enemy.maxHp * 0.3;
		const stunTurns = execution ? 2 : 1;
		applyDebuff(ctx.enemy, { tag: 'stun', turnsLeft: stunTurns, value: 0 }, ctx.rng, ctx.log);
		ctx.enemy.flags.stun_immune_until = ctx.round + stunTurns + 1;
		// Keep the next-attack rider alive through the stunned round(s).
		applyDebuff(ctx.enemy, { tag: 'dizzy', turnsLeft: stunTurns + 1, value: DIZZY_MISS_CHANCE }, ctx.rng, ctx.log);
		ctx.log(COMBAT_FIGHTER_BASH(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy), stunTurns));
	}
}
