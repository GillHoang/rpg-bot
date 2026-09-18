import { NullClassStrategy } from './NullClassStrategy.js';
import type { StrategyContext, OutgoingHit, ResolvedHit } from '../IClassStrategy.js';
import { BOSS_ENTRY } from '../../../config/raidLoot.js';

export class MonsterStrategy extends NullClassStrategy {
	constructor(private readonly skill: string) {
		super();
	}
	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		if (this.skill === 'moon_threshold' && ctx.self.hp < ctx.self.maxHp / 2) {
			hit.damagePctBonus += BOSS_ENTRY.eclipseDamageBonus;
			if (!ctx.self.flags.eclipse) {
				ctx.self.flags.eclipse = true;
				ctx.log('🌑 Bakunawa bước vào Eclipse: sát thương +50%.');
			}
		}
	}
	override onHitLanded(ctx: StrategyContext, hit: ResolvedHit): void {
		if (this.skill === 'flesh_feast')
			ctx.self.hp = Math.min(ctx.self.maxHp, ctx.self.hp + Math.floor(hit.damageDealt * 0.1));
	}
}
