import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import type { RuneEffectKey } from '../../../shared/config/runes.js';
import { createRuneEffectRegistry, type RuneEffectParams } from './runeEffects.js';
import type { EffectRegistry } from './EffectRegistry.js';

/**
 * Decorator pattern: wraps any IClassStrategy (a real class passive, or
 * another rune decorator — they chain) and layers ONE socketed rune's
 * combat-hook effect on top, without the base Strategy classes from M3
 * knowing runes exist at all.
 *
 * Only combat-hook runes need this — the STAT_EFFECT_KEYS
 * family (sharpness/precision/vitality/bulwark) are flat stat bonuses
 * applied once when the CombatantState is built (see RaidService), never
 * a per-turn hook.
 *
 * Open/Closed: effect logic lives in the `runeEffects.ts` handler table;
 * this core only dispatches. A new effect key = one new table entry.
 */
export class RuneStrategyDecorator implements IClassStrategy {
	readonly key: IClassStrategy['key'];

	constructor(
		private readonly inner: IClassStrategy,
		private readonly effectKey: RuneEffectKey,
		private readonly value: number, // fraction from rune_roster, e.g. 0.15 means 15%
		private readonly handlers: EffectRegistry<string, RuneEffectParams> = createRuneEffectRegistry(),
	) {
		this.key = inner.key;
	}

	private get params(): RuneEffectParams {
		return { value: this.value };
	}

	onRoundStart(ctx: StrategyContext): void {
		this.handlers.get(this.effectKey)?.onRoundStart?.(ctx, this.params);
		this.inner.onRoundStart(ctx);
	}

	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		this.inner.prepareOutgoingHit(ctx, hit);
		this.handlers.get(this.effectKey)?.prepareOutgoingHit?.(ctx, hit, this.params);
	}

	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		this.inner.prepareIncomingHit(ctx, hit);
		this.handlers.get(this.effectKey)?.prepareIncomingHit?.(ctx, hit, this.params);
	}

	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onHitLanded(ctx, resolved);
		if (resolved.damageDealt <= 0) return;

		this.handlers.get(this.effectKey)?.onHitLanded?.(ctx, resolved, this.params);
	}

	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onDamageTaken(ctx, resolved);
		this.handlers.get(this.effectKey)?.onDamageTaken?.(ctx, resolved, this.params);
	}

	onRoundEnd(ctx: StrategyContext): void {
		this.inner.onRoundEnd(ctx);
		this.handlers.get(this.effectKey)?.onRoundEnd?.(ctx, this.params);
	}
}

/** Chains one strategy through several socketed combat-rune effects. */
export function wrapWithRunes(
	base: IClassStrategy,
	runes: Array<{ effectKey: RuneEffectKey; value: number }>,
	handlers?: EffectRegistry<string, RuneEffectParams>,
): IClassStrategy {
	return runes.reduce<IClassStrategy>(
		(strategy, rune) => new RuneStrategyDecorator(strategy, rune.effectKey, rune.value, handlers),
		base,
	);
}
