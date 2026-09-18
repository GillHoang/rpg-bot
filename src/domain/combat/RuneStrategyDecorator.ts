import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import type { RuneEffectKey } from '../../config/runes.js';
import { findDebuff } from './CombatantState.js';

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
		private readonly value: number, // percent, e.g. 15 means 15%
	) {
		this.key = inner.key;
	}

	onRoundStart(ctx: StrategyContext): void {
		if (this.effectKey === 'warding') {
			ctx.self.flags.warding_pct = this.value / 100;
		}
		this.inner.onRoundStart(ctx);
	}

	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		this.inner.prepareOutgoingHit(ctx, hit);
		if (this.effectKey === 'piercing') {
			hit.armorPierceFraction = Math.max(hit.armorPierceFraction, this.value / 100);
		}
	}

	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		this.inner.prepareIncomingHit(ctx, hit);
		if (this.effectKey === 'aegis_rune') {
			hit.reductionFraction = Math.max(hit.reductionFraction, this.value / 100);
		}
	}

	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onHitLanded(ctx, resolved);
		if (resolved.damageDealt <= 0) return;

		if (this.effectKey === 'vampiric') {
			const healed = Math.floor(resolved.damageDealt * (this.value / 100));
			if (healed > 0) {
				ctx.self.hp = Math.min(ctx.self.maxHp, ctx.self.hp + healed);
				ctx.log(`🩸 Vampiric Rune — lifesteal ${healed.toLocaleString()} HP.`);
			}
		} else if (this.effectKey === 'venom') {
			const value = Math.floor(ctx.self.atk * (this.value / 100));
			const existing = findDebuff(ctx.enemy, 'venom');
			if (existing) {
				existing.turnsLeft = 2;
				existing.value = Math.max(existing.value, value);
			} else {
				ctx.enemy.debuffs.push({ tag: 'venom', turnsLeft: 2, value });
			}
			ctx.log(`☠️ Venom Rune — applied Poison (${value.toLocaleString()}/turn).`);
		} else if (this.effectKey === 'blight') {
			const existing = findDebuff(ctx.enemy, 'blight');
			if (existing) existing.value = Math.max(existing.value, this.value / 100);
			else ctx.enemy.debuffs.push({ tag: 'blight', turnsLeft: 3, value: this.value / 100 });
		}
	}

	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onDamageTaken(ctx, resolved);
		if (this.effectKey === 'thorns' && resolved.damageDealt > 0) {
			const reflected = Math.floor(resolved.damageDealt * (this.value / 100));
			if (reflected > 0) {
				ctx.enemy.hp = Math.max(0, ctx.enemy.hp - reflected);
				ctx.log(`🌵 Thorns Rune — reflected ${reflected.toLocaleString()} damage back.`);
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
