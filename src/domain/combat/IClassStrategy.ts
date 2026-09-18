import type { CombatClass } from '../entities/PlayerAccount.js';
import type { CombatantState } from './CombatantState.js';

/** Shared context every strategy hook receives. */
export interface StrategyContext {
	self: CombatantState;
	enemy: CombatantState;
	round: number;
	rng: () => number;
	log: (message: string) => void;
}

/**
 * Mutable "attack in progress" object a class strategy tunes before
 * damage is computed. Mirrors how battleEngine.js accumulates
 * `damagePct`, armor-pierce, and forced multipliers onto one hit instead
 * of branching the whole damage formula per class.
 */
export interface OutgoingHit {
	/** Additive damage-% rider, summed into hitMultiplier(crit, damagePct). Fighter +50, Knight +30, etc. */
	damagePctBonus: number;
	/** Fraction of the defender's DEF to ignore (Archer: 0.25). */
	armorPierceFraction: number;
	/** When set, replaces the normal crit/damagePct multiplier entirely (Mage Overcharge). */
	forcedMultiplier: number | null;
	/** When true, a crit can never happen on this hit (Mage Overcharge round). */
	suppressCrit: boolean;
}

export interface IncomingHit {
	/** Additive damage reduction fraction applied to the final amount (Knight: 0.25). */
	reductionFraction: number;
}

export interface ResolvedHit {
	damageDealt: number;
	crit: boolean;
	/** Set by a strategy's onHitLanded to chain one bonus attack (Archer double attack). */
	triggerExtraAttack: boolean;
}

/**
 * Strategy pattern: one implementation per CombatClass. Each hook is a
 * no-op by default (see NullClassStrategy) so a concrete class only
 * overrides the hooks its passive actually needs.
 */
export interface IClassStrategy {
	readonly key: CombatClass | 'none';

	/** Called for both sides at the start of every round, before any attack. */
	onRoundStart(ctx: StrategyContext): void;

	/** Called for the attacker right before damage is computed. */
	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void;

	/** Called for the defender right before damage is computed (Knight DR). */
	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void;

	/** Called for the attacker right after damage lands (Bleed stack, Bash/Stun, Double Attack). */
	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void;

	/** Called for the defender right after damage lands, self=defender/enemy=attacker (rune Thorns reflect). */
	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void;

	/** Called for both sides at the end of every round, after DOT ticks (Knight regen). */
	onRoundEnd(ctx: StrategyContext): void;
}
