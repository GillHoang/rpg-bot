import { formatNumber } from '../../../../shared/ui/text/format.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import { cappedHeal, combatDisplayName, findDebuff } from '../CombatantState.js';
import type { StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from '../IClassStrategy.js';
import {
	COMBAT_KNIGHT_BULWARK,
	COMBAT_KNIGHT_REGEN,
	COMBAT_KNIGHT_SECOND_WIND,
} from '../../../../shared/ui/text/combat.js';

const DAMAGE_REDUCTION = 0.25;
const OUTGOING_BONUS_PCT = 30;
const REGEN_PCT = 0.025;
const BULWARK_REDUCTION = 0.75;
const BULWARK_REFLECT = 0.25;

/**
 * Passive: Damage Reduction + Bulwark — ported from config/classes.js
 * CLASS_PASSIVE_VALUES.Knight. Incoming damage -25%, outgoing damage
 * +30%, and 2.5% max HP regenerated at the end of every round the Knight
 * is still alive. Every 4th round the Knight raises Bulwark: 75%
 * reduction on that round's hits plus 25% damage reflection.
 */
export class KnightStrategy extends NullClassStrategy {
	override readonly key = 'Knight' as const;

	override onRoundStart(ctx: StrategyContext): void {
		// Second wind: once per battle, dropping below 30% HP shrugs off
		// every debuff (Tenacity made flesh).
		if (
			!ctx.self.flags.knight_second_wind_used &&
			ctx.self.hp > 0 &&
			ctx.self.hp < ctx.self.maxHp * 0.3 &&
			ctx.self.debuffs.length > 0
		) {
			ctx.self.flags.knight_second_wind_used = true;
			ctx.self.debuffs = [];
			ctx.log(COMBAT_KNIGHT_SECOND_WIND(combatDisplayName(ctx.self)));
		}
	}

	override prepareOutgoingHit(_ctx: StrategyContext, hit: OutgoingHit): void {
		hit.damagePctBonus += OUTGOING_BONUS_PCT;
	}

	override prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		if (ctx.round % 4 === 0) {
			hit.reductionFraction = Math.max(hit.reductionFraction, BULWARK_REDUCTION);
			ctx.self.flags.knight_bulwark_this_hit = true;
			ctx.log(COMBAT_KNIGHT_BULWARK(combatDisplayName(ctx.self)));
		} else {
			hit.reductionFraction = Math.max(hit.reductionFraction, DAMAGE_REDUCTION);
		}
	}

	override onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		if (!ctx.self.flags.knight_bulwark_this_hit || resolved.damageDealt <= 0) return;
		ctx.self.flags.knight_bulwark_this_hit = false;
		const reflected = Math.floor(resolved.damageDealt * BULWARK_REFLECT);
		if (reflected <= 0 || ctx.enemy.hp <= 0) return;
		ctx.enemy.hp = Math.max(0, ctx.enemy.hp - reflected);
	}

	override onRoundEnd(ctx: StrategyContext): void {
		if (ctx.self.hp <= 0 || ctx.self.hp >= ctx.self.maxHp) return;
		const blightPct = findDebuff(ctx.self, 'blight')?.value ?? 0;
		const restored = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * REGEN_PCT * (1 - blightPct)));
		if (restored <= 0) return;
		ctx.log(COMBAT_KNIGHT_REGEN(combatDisplayName(ctx.self), formatNumber(restored)));
	}
}
