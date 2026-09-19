import { NullClassStrategy } from './NullClassStrategy.js';
import { combatDisplayName } from '../CombatantState.js';
import type { StrategyContext, OutgoingHit, IncomingHit } from '../IClassStrategy.js';
import { findDebuff } from '../CombatantState.js';
import { COMBAT_KNIGHT_REGEN } from '../../../text/combat.js';

const DAMAGE_REDUCTION = 0.25;
const OUTGOING_BONUS_PCT = 30;
const REGEN_PCT = 0.02;

/**
 * Passive: Damage Reduction — ported from config/classes.js
 * CLASS_PASSIVE_VALUES.Knight. Incoming damage -25%, outgoing damage
 * +30%, and 2% max HP regenerated at the end of every round the Knight
 * is still alive.
 */
export class KnightStrategy extends NullClassStrategy {
	override readonly key = 'Knight' as const;

	override prepareOutgoingHit(_ctx: StrategyContext, hit: OutgoingHit): void {
		hit.damagePctBonus += OUTGOING_BONUS_PCT;
	}

	override prepareIncomingHit(_ctx: StrategyContext, hit: IncomingHit): void {
		hit.reductionFraction = Math.max(hit.reductionFraction, DAMAGE_REDUCTION);
	}

	override onRoundEnd(ctx: StrategyContext): void {
		if (ctx.self.hp <= 0 || ctx.self.hp >= ctx.self.maxHp) return;
		const blightPct = findDebuff(ctx.self, 'blight')?.value ?? 0;
		const restored = Math.min(
			ctx.self.maxHp - ctx.self.hp,
			Math.floor(ctx.self.maxHp * REGEN_PCT * (1 - blightPct)),
		);
		if (restored <= 0) return;
		ctx.self.hp += restored;
		ctx.log(COMBAT_KNIGHT_REGEN(combatDisplayName(ctx.self), restored.toLocaleString()));
	}
}
