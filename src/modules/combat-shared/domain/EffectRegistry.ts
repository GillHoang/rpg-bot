import type { IncomingHit, OutgoingHit, ResolvedHit, StrategyContext } from './IClassStrategy.js';

/**
 * One effect's slice of the strategy lifecycle. Every hook is optional: a
 * handler implements only the phases its key needs. `params` carries the
 * per-instance tuning (rune fraction, blessing strength); key-only effects
 * (weapon passives) use `undefined`.
 *
 * `onHitLandedAlways` runs before the decorator's miss/zero-damage guard
 * (for cleanup that must happen even on a miss, e.g. restoring a temporary
 * crit bump); `onHitLanded` runs after the guard.
 */
export interface StrategyHooks<P> {
	onRoundStart?(ctx: StrategyContext, params: P): void;
	prepareOutgoingHit?(ctx: StrategyContext, hit: OutgoingHit, params: P): void;
	prepareIncomingHit?(ctx: StrategyContext, hit: IncomingHit, params: P): void;
	onHitLandedAlways?(ctx: StrategyContext, resolved: ResolvedHit, params: P): void;
	onHitLanded?(ctx: StrategyContext, resolved: ResolvedHit, params: P): void;
	onDamageTaken?(ctx: StrategyContext, resolved: ResolvedHit, params: P): void;
	onRoundEnd?(ctx: StrategyContext, params: P): void;
}

/**
 * Open/Closed dispatch table: adding a new effect key means registering one
 * handler, never editing a decorator. Instances are cheap (`new Map` over a
 * frozen entry list); decorators and factories take an optional registry so
 * tests can inject fakes without touching production tables.
 */
export class EffectRegistry<K extends string, P> {
	private readonly handlers = new Map<K, StrategyHooks<P>>();

	constructor(entries: ReadonlyArray<readonly [K, StrategyHooks<P>]> = []) {
		for (const [key, handler] of entries) this.handlers.set(key, handler);
	}

	register(key: K, handler: StrategyHooks<P>): void {
		this.handlers.set(key, handler);
	}

	get(key: K): StrategyHooks<P> | undefined {
		return this.handlers.get(key);
	}

	has(key: K): boolean {
		return this.handlers.has(key);
	}

	get size(): number {
		return this.handlers.size;
	}
}
