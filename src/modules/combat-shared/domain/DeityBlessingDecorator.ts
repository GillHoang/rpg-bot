import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import type { BlessingKey } from '../../../shared/config/blessings.js';
import { createBlessingEffectRegistry, type BlessingEffectParams } from './blessingEffects.js';
import type { EffectRegistry } from './EffectRegistry.js';

/**
 * Decorator pattern — cùng kiến trúc với RuneStrategyDecorator: bọc bất kỳ
 * IClassStrategy nào (kể cả decorator khác, chain được) và áp MỘT blessing
 * của deity slot 1, không để class Strategy gốc biết blessing tồn tại.
 *
 * `strength` đã tính sẵn ở StatAssemblyService: scalable = 0.5 + 0.05×sigils
 * (cap 1.0), binary = 1. Tailwind không nằm ở đây — nó ghi cờ
 * `initiative_bias` vào CombatantState qua onRoundStart và BattleEngine tự
 * roll lượt đi trước mỗi round dựa trên chênh lệch bias 2 bên.
 *
 * Open/Closed: effect logic lives in the `blessingEffects.ts` handler table;
 * this core only dispatches. A new blessing = one new table entry.
 */
export class DeityBlessingDecorator implements IClassStrategy {
	readonly key: IClassStrategy['key'];

	constructor(
		private readonly inner: IClassStrategy,
		private readonly effectKey: BlessingKey,
		private readonly strength: number,
		private readonly handlers: EffectRegistry<string, BlessingEffectParams> = createBlessingEffectRegistry(),
	) {
		this.key = inner.key;
	}

	private get params(): BlessingEffectParams {
		return { strength: this.strength };
	}

	onRoundStart(ctx: StrategyContext): void {
		this.inner.onRoundStart(ctx);
		this.handlers.get(this.effectKey)?.onRoundStart?.(ctx, this.params);
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

/** Chains one strategy through every blessing of the equipped pantheon lead. */
export function wrapWithBlessings(
	base: IClassStrategy,
	blessings: Array<{ key: string; strength: number }>,
	handlers?: EffectRegistry<string, BlessingEffectParams>,
): IClassStrategy {
	return blessings.reduce<IClassStrategy>(
		(strategy, blessing) =>
			new DeityBlessingDecorator(strategy, blessing.key as BlessingKey, blessing.strength, handlers),
		base,
	);
}
