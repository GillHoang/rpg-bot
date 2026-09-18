import type { CombatClass } from '../../entities/PlayerAccount.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from '../IClassStrategy.js';

/** Used for mobs and as the base class every real passive extends. */
export class NullClassStrategy implements IClassStrategy {
	readonly key: CombatClass | 'none' = 'none';

	onRoundStart(_ctx: StrategyContext): void {}
	prepareOutgoingHit(_ctx: StrategyContext, _hit: OutgoingHit): void {}
	prepareIncomingHit(_ctx: StrategyContext, _hit: IncomingHit): void {}
	onHitLanded(_ctx: StrategyContext, _resolved: ResolvedHit): void {}
	onDamageTaken(_ctx: StrategyContext, _resolved: ResolvedHit): void {}
	onRoundEnd(_ctx: StrategyContext): void {}
}
