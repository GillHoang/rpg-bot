import { rollChance } from '../../../utils/weightedRandom.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { COMBAT_ARCHER_DOUBLE_ATTACK } from '../../../text/combat.js';

const DEFENSE_IGNORE = 0.25;
const DOUBLE_ATTACK_CHANCE = 0.35;

/**
 * Passive: Armor Pierce & Double Attack — ported from config/classes.js
 * CLASS_PASSIVE_VALUES.Archer. Attacks ignore 25% of the target's DEF and
 * have a 35% chance to immediately perform one additional attack (the
 * BattleEngine only honors one extra attack per landed hit — no chained
 * double-double, matching the original's single post-hit burst slot).
 */
export class ArcherStrategy extends NullClassStrategy {
	override readonly key = 'Archer' as const;

	override prepareOutgoingHit(_ctx: StrategyContext, hit: OutgoingHit): void {
		hit.armorPierceFraction = Math.max(hit.armorPierceFraction, DEFENSE_IGNORE);
	}

	override onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		if (resolved.damageDealt <= 0) return;
		if (rollChance(DOUBLE_ATTACK_CHANCE, ctx.rng)) {
			resolved.triggerExtraAttack = true;
			ctx.log(COMBAT_ARCHER_DOUBLE_ATTACK);
		}
	}
}
