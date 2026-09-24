import { formatNumber } from '../../../shared/ui/text/format.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import { cappedHeal, combatDisplayName, immunityMultiplier } from './CombatantState.js';
import { BLESSINGS, type BlessingKey } from '../../../shared/config/blessings.js';
import { rollChance } from '../../../shared/utils/weightedRandom.js';
import {
	COMBAT_BLESSING_GUARDIAN_LIGHT,
	COMBAT_BLESSING_LUNAR_VEIL,
	COMBAT_BLESSING_MOON_DEVOURER,
	COMBAT_BLESSING_MOUNTAIN_GRACE,
	COMBAT_BLESSING_SKY_SOVEREIGN,
	COMBAT_BLESSING_SOLAR_FURY,
	COMBAT_BLESSING_TAILWIND,
	COMBAT_BLESSING_TIDAL_WRATH,
} from '../../../shared/ui/text/combat.js';

/**
 * Decorator pattern — cùng kiến trúc với RuneStrategyDecorator: bọc bất kỳ
 * IClassStrategy nào (kể cả decorator khác, chain được) và áp MỘT blessing
 * của deity slot 1, không để class Strategy gốc biết blessing tồn tại.
 *
 * `strength` đã tính sẵn ở StatAssemblyService: scalable = 0.5 + 0.05×sigils
 * (cap 1.0), binary = 1. Tailwind không nằm ở đây — nó ghi cờ
 * `initiative_bias` vào CombatantState qua onRoundStart và BattleEngine tự
 * roll lượt đi trước mỗi round dựa trên chênh lệch bias 2 bên.
 */
export class DeityBlessingDecorator implements IClassStrategy {
	readonly key: IClassStrategy['key'];
	private readonly tailwindApplied = new WeakSet<StrategyContext['self']>();

	constructor(
		private readonly inner: IClassStrategy,
		private readonly effectKey: BlessingKey,
		private readonly strength: number,
	) {
		this.key = inner.key;
	}

	onRoundStart(ctx: StrategyContext): void {
		this.inner.onRoundStart(ctx);
		if (this.effectKey === 'tailwind') {
			if (!this.tailwindApplied.has(ctx.self)) {
				const current = (ctx.self.flags.initiative_bias as number) ?? 0;
				ctx.self.flags.initiative_bias = current + BLESSINGS.tailwind.value * this.strength;
				this.tailwindApplied.add(ctx.self);
			}
			ctx.log(COMBAT_BLESSING_TAILWIND(combatDisplayName(ctx.self)));
		}
	}

	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		this.inner.prepareOutgoingHit(ctx, hit);
		if (this.effectKey === 'solar_fury') {
			const pct = BLESSINGS.solar_fury.value * 100 * this.strength;
			hit.damagePctBonus += pct;
			ctx.log(COMBAT_BLESSING_SOLAR_FURY(combatDisplayName(ctx.self), Math.round(pct)));
		} else if (this.effectKey === 'tidal_wrath') {
			const missingHpFraction = 1 - ctx.self.hp / ctx.self.maxHp;
			if (missingHpFraction > 0) {
				const bonusPct = BLESSINGS.tidal_wrath.value * 100 * this.strength * missingHpFraction;
				hit.damagePctBonus += bonusPct;
				ctx.log(COMBAT_BLESSING_TIDAL_WRATH(combatDisplayName(ctx.self), Math.round(bonusPct)));
			}
		} else if (
			this.effectKey === 'moon_devourer' &&
			rollChance(BLESSINGS.moon_devourer.value * this.strength, ctx.rng)
		) {
			hit.forcedMultiplier = Math.max(hit.forcedMultiplier ?? 0, 2.0);
			ctx.log(COMBAT_BLESSING_MOON_DEVOURER(combatDisplayName(ctx.self)));
		}
	}

	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		this.inner.prepareIncomingHit(ctx, hit);
		if (this.effectKey === 'mountain_grace' && ctx.self.hp < ctx.self.maxHp / 2) {
			hit.reductionFraction = Math.max(hit.reductionFraction, BLESSINGS.mountain_grace.value * this.strength);
			ctx.log(COMBAT_BLESSING_MOUNTAIN_GRACE(combatDisplayName(ctx.self)));
		} else if (this.effectKey === 'lunar_veil' && ctx.self.flags.blessing_veil_active) {
			ctx.self.flags.blessing_veil_active = false;
			hit.reductionFraction = Math.max(
				hit.reductionFraction,
				BLESSINGS.lunar_veil.value * this.strength * immunityMultiplier(ctx.self),
			);
			ctx.log(COMBAT_BLESSING_LUNAR_VEIL(combatDisplayName(ctx.self)));
		} else if (this.effectKey === 'sky_sovereign' && !ctx.self.flags.blessing_sovereign_used) {
			ctx.self.flags.blessing_sovereign_used = true;
			hit.reductionFraction = Math.max(
				hit.reductionFraction,
				BLESSINGS.sky_sovereign.value * immunityMultiplier(ctx.self),
			);
			ctx.log(COMBAT_BLESSING_SKY_SOVEREIGN(combatDisplayName(ctx.self)));
		}
	}

	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onHitLanded(ctx, resolved);
	}

	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onDamageTaken(ctx, resolved);
		if (this.effectKey === 'lunar_veil' && resolved.damageDealt > 0 && ctx.self.hp > 0) {
			ctx.self.flags.blessing_veil_active = true;
		}
	}

	onRoundEnd(ctx: StrategyContext): void {
		this.inner.onRoundEnd(ctx);
		if (this.effectKey === 'guardian_light' && ctx.self.hp > 0) {
			const healed = cappedHeal(
				ctx.self,
				Math.floor(ctx.self.maxHp * BLESSINGS.guardian_light.value * this.strength),
			);
			if (healed > 0) {
				ctx.log(COMBAT_BLESSING_GUARDIAN_LIGHT(combatDisplayName(ctx.self), formatNumber(healed)));
			}
		}
	}
}

/** Chains one strategy through every blessing of the equipped pantheon lead. */
export function wrapWithBlessings(
	base: IClassStrategy,
	blessings: Array<{ key: string; strength: number }>,
): IClassStrategy {
	return blessings.reduce<IClassStrategy>(
		(strategy, blessing) => new DeityBlessingDecorator(strategy, blessing.key as BlessingKey, blessing.strength),
		base,
	);
}
