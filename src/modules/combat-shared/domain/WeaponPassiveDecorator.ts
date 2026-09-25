import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import { createWeaponPassiveRegistry } from './weaponPassives.js';
import type { EffectRegistry } from './EffectRegistry.js';

/**
 * OwO-style weapon passive decorator.
 *
 * Same architecture as RuneStrategyDecorator/DeityBlessingDecorator: wraps any
 * IClassStrategy (chainable with rune/blessing decorators) and layers ONE
 * equipped weapon's `passiveKey` on top, without class strategies knowing
 * weapons exist. Applies to both sides of PvE and PvP since every service
 * resolves through the shared BattleEngine.
 *
 * Open/Closed: the core below only dispatches to a handler table
 * (`weaponPassives.ts`). A new passive = one new table entry — this file
 * never changes. Unknown keys are a no-op, as before.
 */
export class WeaponPassiveDecorator implements IClassStrategy {
	readonly key: IClassStrategy['key'];

	constructor(
		private readonly inner: IClassStrategy,
		private readonly passiveKey: string,
		private readonly handlers: EffectRegistry<string, undefined> = createWeaponPassiveRegistry(),
	) {
		this.key = inner.key;
	}

	onRoundStart(ctx: StrategyContext): void {
		this.inner.onRoundStart(ctx);
		this.handlers.get(this.passiveKey)?.onRoundStart?.(ctx, undefined);
	}

	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		this.inner.prepareOutgoingHit(ctx, hit);
		this.handlers.get(this.passiveKey)?.prepareOutgoingHit?.(ctx, hit, undefined);
	}

	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		this.inner.prepareIncomingHit(ctx, hit);
		this.handlers.get(this.passiveKey)?.prepareIncomingHit?.(ctx, hit, undefined);
	}

	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onHitLanded(ctx, resolved);
		const handler = this.handlers.get(this.passiveKey);
		handler?.onHitLandedAlways?.(ctx, resolved, undefined);
		if (resolved.missed || resolved.damageDealt <= 0) return;
		handler?.onHitLanded?.(ctx, resolved, undefined);
	}

	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onDamageTaken(ctx, resolved);
		this.handlers.get(this.passiveKey)?.onDamageTaken?.(ctx, resolved, undefined);
	}

	onRoundEnd(ctx: StrategyContext): void {
		this.inner.onRoundEnd(ctx);
		this.handlers.get(this.passiveKey)?.onRoundEnd?.(ctx, undefined);
	}
}

/** Wraps a strategy with the equipped weapon's passive; 'none'/missing is a no-op. */
export function wrapWithWeaponPassive(
	base: IClassStrategy,
	passiveKey: string | null | undefined,
	handlers?: EffectRegistry<string, undefined>,
): IClassStrategy {
	if (!passiveKey || passiveKey === 'none') return base;
	return new WeaponPassiveDecorator(base, passiveKey, handlers);
}
