import type { CombatClass } from '../../../identity/domain/PlayerAccount.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from '../IClassStrategy.js';

/** Used for mobs and as the base class every real passive extends. */
export class NullClassStrategy implements IClassStrategy {
	readonly key: CombatClass | 'none' = 'none';

	onRoundStart(_ctx: StrategyContext): void {
		// Intentional no-op: the hook contract requires an implementation.
	}
	prepareOutgoingHit(_ctx: StrategyContext, _hit: OutgoingHit): void {
		// Intentional no-op: see onRoundStart.
	}
	prepareIncomingHit(_ctx: StrategyContext, _hit: IncomingHit): void {
		// Intentional no-op: see onRoundStart.
	}
	onHitLanded(_ctx: StrategyContext, _resolved: ResolvedHit): void {
		// Intentional no-op: see onRoundStart.
	}
	onDamageTaken(_ctx: StrategyContext, _resolved: ResolvedHit): void {
		// Intentional no-op: see onRoundStart.
	}
	onRoundEnd(_ctx: StrategyContext): void {
		// Intentional no-op: see onRoundStart.
	}
}
