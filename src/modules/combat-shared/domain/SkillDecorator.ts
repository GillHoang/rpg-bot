import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import type { StrategyHooks } from './EffectRegistry.js';
import type { BattleStance, ReadySkill, SkillDef } from '../../../shared/config/skills.js';
import { createSkillRegistry } from './skillEffects.js';
import type { EffectRegistry } from './EffectRegistry.js';

/**
 * Phase 2 skill decorator: wraps the attacker's strategy for ONE turn with
 * the chosen skill's hooks, without class strategies knowing skills exist.
 * Same OCP shape as RuneStrategyDecorator — a new skill = one table entry.
 */
export class SkillDecorator implements IClassStrategy {
	readonly key: IClassStrategy['key'];

	constructor(
		private readonly inner: IClassStrategy,
		private readonly skillKey: string,
		private readonly skill: SkillDef,
		private readonly handlers: EffectRegistry<string, SkillDef> = createSkillRegistry(),
	) {
		this.key = inner.key;
	}

	private get handler(): StrategyHooks<SkillDef> | undefined {
		return this.handlers.get(this.skillKey);
	}

	onRoundStart(ctx: StrategyContext): void {
		this.inner.onRoundStart(ctx);
	}

	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		this.inner.prepareOutgoingHit(ctx, hit);
		this.handler?.prepareOutgoingHit?.(ctx, hit, this.skill);
	}

	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		this.inner.prepareIncomingHit(ctx, hit);
	}

	chooseSkill(ctx: StrategyContext, skills: readonly ReadySkill[], stance: BattleStance): string | null {
		return this.inner.chooseSkill?.(ctx, skills, stance) ?? null;
	}

	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onHitLanded(ctx, resolved);
		if (resolved.damageDealt <= 0) return;
		this.handler?.onHitLanded?.(ctx, resolved, this.skill);
	}

	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onDamageTaken(ctx, resolved);
	}

	onRoundEnd(ctx: StrategyContext): void {
		this.inner.onRoundEnd(ctx);
	}
}
