import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import type { RuneEffectKey } from '../../config/runes.js';
import { combatDisplayName, findDebuff } from './CombatantState.js';
import { COMBAT_RUNE_THORNS, COMBAT_RUNE_VAMPIRIC, COMBAT_RUNE_VENOM } from '../../text/combat.js';

/**
 * Decorator pattern: wraps any IClassStrategy (a real class passive, or
 * another rune decorator — they chain) and layers ONE socketed rune's
 * combat-hook effect on top, without the base Strategy classes from M3
 * knowing runes exist at all. One parameterized class (rather than 7
 * near-identical subclasses) mirrors how config/runes.js itself treats
 * these as one data-driven effect-key table, not 7 bespoke systems.
 *
 * Only the COMBAT_EFFECT_KEYS family needs this — the STAT_EFFECT_KEYS
 * family (sharpness/precision/vitality/bulwark) are flat stat bonuses
 * applied once when the CombatantState is built (see RaidService), never
 * a per-turn hook.
 */
export class RuneStrategyDecorator implements IClassStrategy {
	readonly key: IClassStrategy['key'];

	constructor(
		private readonly inner: IClassStrategy,
		private readonly effectKey: RuneEffectKey,
		private readonly value: number, // fraction from rune_roster, e.g. 0.15 means 15%
	) {
		this.key = inner.key;
	}

	onRoundStart(ctx: StrategyContext): void {
		if (this.effectKey === 'warding') {
			ctx.self.flags.warding_pct = this.value;
		}
		this.inner.onRoundStart(ctx);
	}

	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		this.inner.prepareOutgoingHit(ctx, hit);
		if (this.effectKey === 'piercing') {
			hit.armorPierceFraction = Math.max(hit.armorPierceFraction, this.value);
		}
	}

	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		this.inner.prepareIncomingHit(ctx, hit);
		if (this.effectKey === 'warding') hit.reductionFraction = Math.max(hit.reductionFraction, this.value);
		if (this.effectKey === 'aegis_rune' && !ctx.self.flags.aegis_used) {
			hit.reductionFraction = 1;
			ctx.self.flags.aegis_used = true;
		}
	}

	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onHitLanded(ctx, resolved);
		if (resolved.damageDealt <= 0) return;

		if (this.effectKey === 'vampiric') {
			const healed = Math.floor(resolved.damageDealt * this.value);
			if (healed > 0) {
				ctx.self.hp = Math.min(ctx.self.maxHp, ctx.self.hp + healed);
				ctx.log(COMBAT_RUNE_VAMPIRIC(combatDisplayName(ctx.self), healed.toLocaleString()));
			}
		} else if (this.effectKey === 'venom') {
			const value = Math.floor(ctx.enemy.maxHp * this.value);
			const existing = findDebuff(ctx.enemy, 'venom');
			if (existing) {
				existing.turnsLeft = 2;
				existing.value += value;
			} else {
				ctx.enemy.debuffs.push({ tag: 'venom', turnsLeft: 2, value });
			}
			ctx.log(COMBAT_RUNE_VENOM(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy), value.toLocaleString()));
		} else if (this.effectKey === 'blight') {
			const existing = findDebuff(ctx.enemy, 'blight');
			if (existing) {
				existing.value = Math.max(existing.value, this.value);
				existing.turnsLeft = 1;
			} else ctx.enemy.debuffs.push({ tag: 'blight', turnsLeft: 1, value: this.value });
		}
	}

	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onDamageTaken(ctx, resolved);
		if (this.effectKey === 'thorns' && resolved.damageDealt > 0) {
			const reflected = Math.floor(resolved.damageDealt * this.value);
			if (reflected > 0) {
				ctx.enemy.hp = Math.max(0, ctx.enemy.hp - reflected);
				ctx.log(COMBAT_RUNE_THORNS(combatDisplayName(ctx.self), reflected.toLocaleString()));
			}
		}
	}

	onRoundEnd(ctx: StrategyContext): void {
		this.inner.onRoundEnd(ctx);
	}
}

/** Chains one strategy through several socketed combat-rune effects. */
export function wrapWithRunes(
	base: IClassStrategy,
	runes: Array<{ effectKey: RuneEffectKey; value: number }>,
): IClassStrategy {
	return runes.reduce<IClassStrategy>(
		(strategy, rune) => new RuneStrategyDecorator(strategy, rune.effectKey, rune.value),
		base,
	);
}
