import { formatNumber } from '../../../shared/ui/text/format.js';
import type { CombatantState } from './CombatantState.js';
import { combatDisplayName, findDebuff } from './CombatantState.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import { mitigate, rollVariance, rollCrit, rollHit, hitMultiplier, effectivePierce } from './DamageCalculator.js';
import { suddenDeathMultiplier } from './combatRules.js';
import {
	COMBAT_DEFEATED_SUFFIX,
	COMBAT_GUARD,
	COMBAT_HIT,
	COMBAT_MISS,
	COMBAT_STRIKE_EMOJIS,
	COMBAT_TAGS,
} from '../../../shared/ui/text/combat.js';

export interface IBattleAttackResolver {
	executeStrike(
		attacker: CombatantState,
		defender: CombatantState,
		attackerStrategy: IClassStrategy,
		defenderStrategy: IClassStrategy,
		context: StrategyContext,
	): void;
}

/** Stateless attack policy composed into the round orchestrator. */
export class BattleAttackResolver implements IBattleAttackResolver {
	/** One attack plus the Archer-style immediate extra attack if the strategy triggered one. */
	executeStrike(
		attacker: CombatantState,
		defender: CombatantState,
		atkStrategy: IClassStrategy,
		defStrategy: IClassStrategy,
		ctx: StrategyContext,
	): void {
		const resolved = this.performAttack(attacker, defender, atkStrategy, defStrategy, ctx);
		if (resolved.triggerExtraAttack && defender.hp > 0 && attacker.hp > 0) {
			this.performAttack(attacker, defender, atkStrategy, defStrategy, ctx);
		}
	}

	private performAttack(
		attacker: CombatantState,
		defender: CombatantState,
		atkStrategy: IClassStrategy,
		defStrategy: IClassStrategy,
		ctx: StrategyContext,
	): ResolvedHit {
		const hit: OutgoingHit = {
			damagePctBonus: 0,
			armorPierceFraction: 0,
			forcedMultiplier: null,
			suppressCrit: false,
			varianceRange: [0.9, 1.1],
		};
		atkStrategy.prepareOutgoingHit(ctx, hit);

		// P2 hit roll: a miss skips guard/mitigation hooks (aegis, veil and
		// sovereign are not consumed) and resolves as a zero-damage hit.
		if (!rollHit(ctx.rng, attacker.acc, defender.eva)) {
			ctx.log(COMBAT_MISS(combatDisplayName(attacker), combatDisplayName(defender)));
			const missed: ResolvedHit = { damageDealt: 0, crit: false, missed: true, triggerExtraAttack: false };
			atkStrategy.onHitLanded(ctx, missed);
			return missed;
		}

		const incoming: IncomingHit = { reductionFraction: 0 };
		const defCtx: StrategyContext = {
			self: defender,
			enemy: attacker,
			round: ctx.round,
			rng: ctx.rng,
			log: ctx.log,
		};
		defStrategy.prepareIncomingHit(defCtx, incoming);

		const atkDownPct = Math.min(
			1,
			(findDebuff(attacker, 'atk_down')?.value ?? 0) + (findDebuff(attacker, 'blight')?.value ?? 0),
		);
		const defDownPct = findDebuff(defender, 'def_down')?.value ?? 0;

		const effAtk = attacker.atk * (1 - atkDownPct);
		const effDef = defender.def * (1 - defDownPct) * (1 - effectivePierce(hit.armorPierceFraction));

		const variance = rollVariance(ctx.rng, hit.varianceRange);
		const crit = !hit.suppressCrit && hit.forcedMultiplier == null && rollCrit(ctx.rng, attacker.crit);

		let amount: number;
		if (hit.forcedMultiplier != null) {
			amount = mitigate(effAtk, effDef) * variance * hit.forcedMultiplier;
		} else {
			amount = mitigate(effAtk, effDef) * variance * hitMultiplier(crit, hit.damagePctBonus);
		}
		amount *= 1 - incoming.reductionFraction;
		amount *= suddenDeathMultiplier(ctx.round);

		const dealt = Math.max(0, Math.floor(amount));
		defender.hp = Math.max(0, defender.hp - dealt);

		ctx.log(
			COMBAT_HIT(
				crit ? COMBAT_TAGS.CRIT : COMBAT_TAGS.PHYS,
				crit ? COMBAT_STRIKE_EMOJIS.crit : (attacker.attackEmoji ?? COMBAT_STRIKE_EMOJIS.bareHand),
				combatDisplayName(attacker),
				combatDisplayName(defender),
				formatNumber(dealt),
				defender.hp <= 0 ? COMBAT_DEFEATED_SUFFIX(combatDisplayName(defender)) : '',
			),
		);
		if (incoming.reductionFraction > 0) {
			ctx.log(COMBAT_GUARD(combatDisplayName(defender), Math.round(incoming.reductionFraction * 100)));
		}

		const resolved: ResolvedHit = { damageDealt: dealt, crit, missed: false, triggerExtraAttack: false };
		atkStrategy.onHitLanded(ctx, resolved);

		if (defender.hp > 0) {
			const defTakenCtx: StrategyContext = {
				self: defender,
				enemy: attacker,
				round: ctx.round,
				rng: ctx.rng,
				log: ctx.log,
			};
			defStrategy.onDamageTaken(defTakenCtx, resolved);
		}
		return resolved;
	}
}
