import { rollChance, choose } from '../../../utils/weightedRandom.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { combatDisplayName, findDebuff } from '../CombatantState.js';
import {
	MAGE_OVERCHARGE_MULT,
	MAGE_OVERCHARGE_HIGH_MULT,
	MAGE_OVERCHARGE_HIGH_CHANCE,
	MAGE_OVERCHARGE_EVERY,
} from '../DamageCalculator.js';
import { COMBAT_MAGE_OVERCHARGE } from '../../../text/combat.js';

type OverchargeDebuff = 'paralyze' | 'burn' | 'def_down' | 'atk_down';
const OVERCHARGE_DEBUFFS: OverchargeDebuff[] = ['paralyze', 'burn', 'def_down', 'atk_down'];

/**
 * Passive: Overcharge — ported from config/combat.js's OVERCHARGE_*
 * constants. Every 3rd round, the Mage's attack rolls a forced 4.0x
 * (60%) or 5.0x (40%) multiplier, cannot crit, and — if it lands —
 * applies one random 25%-chance debuff among Paralyze / Burn / DEF Down
 * / ATK Down.
 */
export class MageStrategy extends NullClassStrategy {
	override readonly key = 'Mage' as const;

	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		if (ctx.round % MAGE_OVERCHARGE_EVERY !== 0) return;
		hit.suppressCrit = true;
		hit.forcedMultiplier = rollChance(MAGE_OVERCHARGE_HIGH_CHANCE, ctx.rng)
			? MAGE_OVERCHARGE_HIGH_MULT
			: MAGE_OVERCHARGE_MULT;
		ctx.self.flags.mage_overcharge_this_hit = true;
	}

	override onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		if (!ctx.self.flags.mage_overcharge_this_hit) return;
		ctx.self.flags.mage_overcharge_this_hit = false;
		if (resolved.damageDealt <= 0) return;

		const pick = choose(OVERCHARGE_DEBUFFS, ctx.rng);
		ctx.log(COMBAT_MAGE_OVERCHARGE(combatDisplayName(ctx.self), pick));

		if (pick === 'paralyze') {
			ctx.enemy.debuffs.push({ tag: 'paralyze', turnsLeft: 1, value: 0 });
		} else if (pick === 'burn') {
			const existing = findDebuff(ctx.enemy, 'burn');
			const value = Math.floor(ctx.self.atk * 0.1);
			if (existing) {
				existing.turnsLeft = 2;
				existing.value = Math.max(existing.value, value);
			} else {
				ctx.enemy.debuffs.push({ tag: 'burn', turnsLeft: 2, value });
			}
		} else {
			ctx.enemy.debuffs.push({ tag: pick, turnsLeft: 1, value: 0.25 });
		}
	}
}
