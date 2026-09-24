import { rollChance } from '../../../../shared/utils/weightedRandom.js';
import { combatDisplayName } from '../CombatantState.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { COMBAT_ARCHER_AIMED, COMBAT_ARCHER_DOUBLE_ATTACK } from '../../../../shared/ui/text/combat.js';

const DEFENSE_IGNORE = 0.25;
const DOUBLE_ATTACK_CHANCE = 0.35;
const AIMED_PIERCE = 0.45;
const AIMED_BONUS_PCT = 20;

/**
 * Passive: Armor Pierce & Double Attack — ported from config/classes.js
 * CLASS_PASSIVE_VALUES.Archer. Odd shots fight skirmish-style (25% DEF
 * ignored, 35% chance of one immediate extra attack — never chained).
 * Even shots are aimed: deeper pierce (45%), a tight variance window and
 * +20% damage, but no double attack.
 */
export class ArcherStrategy extends NullClassStrategy {
	override readonly key = 'Archer' as const;

	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		// An extra swing repeats the skirmish style instead of consuming
		// the next alternating shot (flags only hold number|boolean).
		if (ctx.self.flags.archer_extra_swing === true) {
			ctx.self.flags.archer_extra_swing = false;
			this.applyStyle(ctx, hit, 'skirmish');
			return;
		}
		const shots = ((ctx.self.flags.archer_shots as number) ?? 0) + 1;
		ctx.self.flags.archer_shots = shots;
		this.applyStyle(ctx, hit, shots % 2 === 0 ? 'aimed' : 'skirmish');
	}

	private applyStyle(ctx: StrategyContext, hit: OutgoingHit, style: 'aimed' | 'skirmish'): void {
		if (style === 'aimed') {
			hit.armorPierceFraction = Math.max(hit.armorPierceFraction, AIMED_PIERCE);
			hit.damagePctBonus += AIMED_BONUS_PCT;
			hit.varianceRange = [0.95, 1.05];
			ctx.self.flags.archer_aimed_this_hit = true;
			ctx.log(COMBAT_ARCHER_AIMED(combatDisplayName(ctx.self)));
		} else {
			hit.armorPierceFraction = Math.max(hit.armorPierceFraction, DEFENSE_IGNORE);
			ctx.self.flags.archer_aimed_this_hit = false;
		}
	}

	override onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		const aimed = ctx.self.flags.archer_aimed_this_hit === true;
		ctx.self.flags.archer_aimed_this_hit = false;
		if (aimed || resolved.damageDealt <= 0) return;
		if (rollChance(DOUBLE_ATTACK_CHANCE, ctx.rng)) {
			resolved.triggerExtraAttack = true;
			ctx.self.flags.archer_extra_swing = true;
			ctx.log(COMBAT_ARCHER_DOUBLE_ATTACK(combatDisplayName(ctx.self)));
		}
	}
}
