import { rollChance, choose } from '../../../../shared/utils/weightedRandom.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { applyDebuff, combatDisplayName, findDebuff } from '../CombatantState.js';
import {
	MAGE_OVERCHARGE_MULT,
	MAGE_OVERCHARGE_HIGH_MULT,
	MAGE_OVERCHARGE_HIGH_CHANCE,
	MAGE_OVERCHARGE_EVERY,
} from '../DamageCalculator.js';
import { COMBAT_MAGE_OVERCHARGE, COMBAT_MAGE_WEAVE } from '../../../../shared/ui/text/combat.js';

type OverchargeDebuff = 'paralyze' | 'burn' | 'def_down' | 'atk_down';
const OVERCHARGE_DEBUFFS: OverchargeDebuff[] = ['paralyze', 'burn', 'def_down', 'atk_down'];

/**
 * Passive: Overcharge + Spellweave — ported from config/combat.js's
 * OVERCHARGE_* constants. Every 3rd round, the Mage's attack rolls a
 * forced 4.0x (60%) or 5.0x (40%) multiplier, cannot crit, and — if it
 * lands — applies one random debuff among Paralyze / Burn / DEF Down /
 * ATK Down. Spellweave: if the enemy still carries a previous weave
 * debuff, it is consumed for a guaranteed 5.0x instead of rolling.
 */
export class MageStrategy extends NullClassStrategy {
	override readonly key = 'Mage' as const;

	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		if (ctx.round % MAGE_OVERCHARGE_EVERY !== 0) return;
		hit.suppressCrit = true;
		const woven = this.consumeWeave(ctx);
		hit.forcedMultiplier = this.overchargeMultiplier(ctx, woven);
		if (woven) ctx.log(COMBAT_MAGE_WEAVE(combatDisplayName(ctx.self)));
		ctx.self.flags.mage_overcharge_this_hit = true;
	}

	/** Weave consumes to a guaranteed max roll; otherwise roll the 40% high chance. */
	private overchargeMultiplier(ctx: StrategyContext, woven: boolean): number {
		if (woven) return MAGE_OVERCHARGE_HIGH_MULT;
		return rollChance(MAGE_OVERCHARGE_HIGH_CHANCE, ctx.rng) ? MAGE_OVERCHARGE_HIGH_MULT : MAGE_OVERCHARGE_MULT;
	}

	/** Consume one pending weave debuff for a guaranteed max overcharge. */
	private consumeWeave(ctx: StrategyContext): boolean {
		const index = ctx.enemy.debuffs.findIndex((d) =>
			(['paralyze', 'burn', 'def_down', 'atk_down'] as const).includes(
				d.tag as (typeof OVERCHARGE_DEBUFFS)[number],
			),
		);
		if (index < 0) return false;
		ctx.enemy.debuffs.splice(index, 1);
		return true;
	}

	override onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		if (!ctx.self.flags.mage_overcharge_this_hit) return;
		ctx.self.flags.mage_overcharge_this_hit = false;
		if (resolved.damageDealt <= 0) return;

		const pick = choose(OVERCHARGE_DEBUFFS, ctx.rng);
		ctx.log(COMBAT_MAGE_OVERCHARGE(combatDisplayName(ctx.self), pick));

		if (pick === 'paralyze') {
			applyDebuff(ctx.enemy, { tag: 'paralyze', turnsLeft: 1, value: 0 }, ctx.rng, ctx.log);
		} else if (pick === 'burn') {
			const existing = findDebuff(ctx.enemy, 'burn');
			const value = Math.floor(ctx.self.atk * 0.1);
			if (existing) {
				existing.turnsLeft = 2;
				existing.value = Math.max(existing.value, value);
			} else {
				applyDebuff(ctx.enemy, { tag: 'burn', turnsLeft: 2, value }, ctx.rng, ctx.log);
			}
		} else {
			applyDebuff(ctx.enemy, { tag: pick, turnsLeft: 1, value: 0.25 }, ctx.rng, ctx.log);
		}
	}
}
