import type { CombatClass } from '../../../identity/domain/PlayerAccount.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from '../IClassStrategy.js';
import { chooseSkillByStance, type BattleStance, type ReadySkill } from '../../../../shared/config/skills.js';

/** Used for mobs and as the base class every real passive extends. */
export class NullClassStrategy implements IClassStrategy {
	readonly key: CombatClass | 'none' = 'none';

	chooseSkill(_ctx: StrategyContext, skills: readonly ReadySkill[], stance: BattleStance): string | null {
		// Deterministic stance priority shared by every class (no RNG): mobs
		// carry no skills so this is a no-op for them.
		return chooseSkillByStance(skills, stance);
	}
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
