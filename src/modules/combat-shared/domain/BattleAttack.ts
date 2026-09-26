import { formatNumber } from '../../../shared/ui/text/format.js';
import type { CombatantState } from './CombatantState.js';
import { combatDisplayName, findDebuff } from './CombatantState.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import {
	mitigate,
	rollVariance,
	rollCrit,
	rollHit,
	hitMultiplier,
	effectivePierce,
	armorTypeMultiplier,
} from './DamageCalculator.js';
import { EARLY_SUDDEN_DEATH_START, suddenDeathMultiplier } from './combatRules.js';
import { SKILL_RESOURCE } from '../../../shared/config/skills.js';
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
		// Clamp shred to [0,1]: an unclamped def_down >= 1 would flip effDef
		// negative and make mitigate() non-monotonic (def = -600 divides by zero).
		const defDownPct = Math.min(1, Math.max(0, findDebuff(defender, 'def_down')?.value ?? 0));

		const effAtk = attacker.atk * (1 - atkDownPct);
		// Flat armor penetration chips effective DEF before mitigation (0 = none).
		const effDef = Math.max(
			0,
			defender.def * (1 - defDownPct) * (1 - effectivePierce(hit.armorPierceFraction)) - attacker.penFlat,
		);

		const variance = rollVariance(ctx.rng, hit.varianceRange);
		const crit = !hit.suppressCrit && hit.forcedMultiplier == null && rollCrit(ctx.rng, attacker.crit);
		// Counter matrix (Phase 1): 1.0 while DAMAGE_TYPE_MATRIX_ENABLED is off.
		const armorMult = armorTypeMultiplier(attacker.damageType, defender.armorType);

		let amount: number;
		if (hit.forcedMultiplier != null) {
			amount = mitigate(effAtk, effDef) * variance * hit.forcedMultiplier;
		} else {
			amount = mitigate(effAtk, effDef) * variance * hitMultiplier(crit, hit.damagePctBonus, attacker.critDmg);
		}
		amount *= armorMult;
		amount *= 1 - incoming.reductionFraction;
		// Phase 4 weekly frenzy rides on top of class riders; weekly bloodmoon
		// uses the early enrage window when either side carries the flag.
		amount *= 1 + attacker.flags.fieldDamagePct;
		amount *= suddenDeathMultiplier(
			ctx.round,
			attacker.flags.earlySuddenDeath || defender.flags.earlySuddenDeath
				? EARLY_SUDDEN_DEATH_START
				: undefined,
		);

		const dealt = Math.max(0, Math.floor(amount));
		// Shield absorbs before HP (0 shield = unchanged); damageDealt stays the
		// total so lifesteal/thorns scale off the real hit, not the HP remainder.
		const absorbed = Math.min(defender.shield, dealt);
		defender.shield -= absorbed;
		defender.hp = Math.max(0, defender.hp - (dealt - absorbed));

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
		// Phase 2 skill resource: loadout runners build resource when they deal
		// or take real damage (0 skills = zero behavior change). Shield-absorbed
		// damage counts — the hit still landed.
		if (!resolved.missed && resolved.damageDealt > 0) {
			if (attacker.skills.length > 0) {
				attacker.flags.resource = Math.min(
					SKILL_RESOURCE.max,
					attacker.flags.resource + SKILL_RESOURCE.gainDealt,
				);
			}
			if (defender.skills.length > 0) {
				defender.flags.resource = Math.min(
					SKILL_RESOURCE.max,
					defender.flags.resource + SKILL_RESOURCE.gainTaken,
				);
			}
		}

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
