import { formatNumber } from '../../../../shared/ui/text/format.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { applyDebuff, combatDisplayName, findDebuff } from '../CombatantState.js';
import {
	COMBAT_SWORDSMAN_ATK_UP,
	COMBAT_SWORDSMAN_BLEED,
	COMBAT_SWORDSMAN_DETONATE,
} from '../../../../shared/ui/text/combat.js';

const BLEED_PCT_PER_STACK = 0.04;
const BLEED_MAX_PCT = 0.2;
const BLEED_MAX_STACKS = Math.ceil(BLEED_MAX_PCT / BLEED_PCT_PER_STACK); // 5
const ATK_STACK_PER_TURN = 0.05;
const ATK_STACK_MAX = 0.3;

/**
 * Passive: Bleed — ported from config/classes.js CLASS_PASSIVE_VALUES.Swordsman
 * and battleEngine.js's applySwordsmanBleedStack.
 *  - Each landed attack adds/refreshes one Bleed stack on the defender
 *    (max 5 stacks, 4%/stack, capped at 20% of the Swordsman's ATK), which
 *    ticks as damage-over-time for 2 rounds.
 *  - The Swordsman's own ATK also grows +5% per turn acted, capped at +30%
 *    for the rest of the battle (never decays).
 */
export class SwordsmanStrategy extends NullClassStrategy {
	override readonly key = 'Swordsman' as const;

	override prepareOutgoingHit(ctx: StrategyContext, _hit: OutgoingHit): void {
		// Apply the accrued ATK stack (if any) before this hit's damage is rolled.
		const stackPct = ctx.self.flags.swordsmanAtkStackPct;
		if (stackPct > 0) {
			ctx.self.flags.swordsmanAtkStackBase ??= ctx.self.atk;
			const base = ctx.self.flags.swordsmanAtkStackBase ?? ctx.self.atk;
			ctx.self.atk = Math.floor(base * (1 + stackPct));
		}
	}

	override onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		if (resolved.damageDealt <= 0) return;

		// Grow the permanent-for-battle ATK stack.
		const current = ctx.self.flags.swordsmanAtkStackPct;
		if (current < ATK_STACK_MAX) {
			const next = Math.min(ATK_STACK_MAX, current + ATK_STACK_PER_TURN);
			ctx.self.flags.swordsmanAtkStackPct = next;
			ctx.log(COMBAT_SWORDSMAN_ATK_UP(combatDisplayName(ctx.self), Math.round((next - current) * 100)));
		}

		// Apply/refresh the Bleed stack on the defender.
		const existing = findDebuff(ctx.enemy, 'bleed');
		const stacks = Math.min(BLEED_MAX_STACKS, (existing?.stacks ?? 0) + 1);
		const value = Math.min(BLEED_MAX_PCT, stacks * BLEED_PCT_PER_STACK) * ctx.self.atk;
		if (existing) {
			existing.turnsLeft = 2;
			existing.value = Math.max(existing.value, value);
			existing.stacks = stacks;
		} else {
			applyDebuff(ctx.enemy, { tag: 'bleed', turnsLeft: 2, value, stacks }, ctx.rng, ctx.log);
		}
		const pct = Math.round(Math.min(BLEED_MAX_PCT, stacks * BLEED_PCT_PER_STACK) * 100);
		ctx.log(
			COMBAT_SWORDSMAN_BLEED(
				combatDisplayName(ctx.self),
				combatDisplayName(ctx.enemy),
				stacks,
				BLEED_MAX_STACKS,
				pct,
			),
		);
		// Hemorrhage payoff: a full 5-stack wound detonates for instant true
		// damage on top of the ticking bleed (stacks are kept, not consumed).
		if (stacks >= BLEED_MAX_STACKS && ctx.enemy.hp > 0) {
			const burst = Math.floor(value);
			if (burst > 0) {
				ctx.enemy.hp = Math.max(0, ctx.enemy.hp - burst);
				ctx.log(
					COMBAT_SWORDSMAN_DETONATE(
						combatDisplayName(ctx.self),
						combatDisplayName(ctx.enemy),
						formatNumber(burst),
					),
				);
			}
		}
	}
}
