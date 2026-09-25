import { formatNumber } from '../../../shared/ui/text/format.js';
import { cappedHeal, combatDisplayName, immunityMultiplier } from './CombatantState.js';
import { BLESSINGS } from '../../../shared/config/blessings.js';
import { rollChance } from '../../../shared/utils/weightedRandom.js';
import type { StrategyContext } from './IClassStrategy.js';
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
import { EffectRegistry, type StrategyHooks } from './EffectRegistry.js';

/** Per-instance tuning: Sigil-derived strength from StatAssemblyService. */
export interface BlessingEffectParams {
	strength: number;
}

export type BlessingEffectHandler = StrategyHooks<BlessingEffectParams>;

// Tailwind bias applies once per combatant across rounds. Keyed by the
// battle-local CombatantState object (WeakSet: no leak, no cross-battle
// contamination — each battle builds fresh state via the factory).
const tailwindApplied = new WeakSet<StrategyContext['self']>();

/**
 * Built-in blessing table, transcribed 1:1 from the former
 * `DeityBlessingDecorator` if-chain.
 */
export const DEFAULT_BLESSING_EFFECT_ENTRIES: ReadonlyArray<readonly [string, BlessingEffectHandler]> = [
	[
		'tailwind',
		{
			onRoundStart(ctx, params) {
				if (!tailwindApplied.has(ctx.self)) {
					const current = ctx.self.flags.initiativeBias;
					ctx.self.flags.initiativeBias = current + BLESSINGS.tailwind.value * params.strength;
					tailwindApplied.add(ctx.self);
				}
				ctx.log(COMBAT_BLESSING_TAILWIND(combatDisplayName(ctx.self)));
			},
		},
	],
	[
		'solar_fury',
		{
			prepareOutgoingHit(ctx, hit, params) {
				const pct = BLESSINGS.solar_fury.value * 100 * params.strength;
				hit.damagePctBonus += pct;
				ctx.log(COMBAT_BLESSING_SOLAR_FURY(combatDisplayName(ctx.self), Math.round(pct)));
			},
		},
	],
	[
		'tidal_wrath',
		{
			prepareOutgoingHit(ctx, hit, params) {
				const missingHpFraction = 1 - ctx.self.hp / ctx.self.maxHp;
				if (missingHpFraction > 0) {
					const bonusPct = BLESSINGS.tidal_wrath.value * 100 * params.strength * missingHpFraction;
					hit.damagePctBonus += bonusPct;
					ctx.log(COMBAT_BLESSING_TIDAL_WRATH(combatDisplayName(ctx.self), Math.round(bonusPct)));
				}
			},
		},
	],
	[
		'moon_devourer',
		{
			prepareOutgoingHit(ctx, hit, params) {
				if (rollChance(BLESSINGS.moon_devourer.value * params.strength, ctx.rng)) {
					hit.forcedMultiplier = Math.max(hit.forcedMultiplier ?? 0, 2.0);
					ctx.log(COMBAT_BLESSING_MOON_DEVOURER(combatDisplayName(ctx.self)));
				}
			},
		},
	],
	[
		'mountain_grace',
		{
			prepareIncomingHit(ctx, hit, params) {
				if (ctx.self.hp < ctx.self.maxHp / 2) {
					hit.reductionFraction = Math.max(
						hit.reductionFraction,
						BLESSINGS.mountain_grace.value * params.strength,
					);
					ctx.log(COMBAT_BLESSING_MOUNTAIN_GRACE(combatDisplayName(ctx.self)));
				}
			},
		},
	],
	[
		'lunar_veil',
		{
			prepareIncomingHit(ctx, hit, params) {
				if (ctx.self.flags.blessingVeilActive) {
					ctx.self.flags.blessingVeilActive = false;
					hit.reductionFraction = Math.max(
						hit.reductionFraction,
						BLESSINGS.lunar_veil.value * params.strength * immunityMultiplier(ctx.self),
					);
					ctx.log(COMBAT_BLESSING_LUNAR_VEIL(combatDisplayName(ctx.self)));
				}
			},
			onDamageTaken(ctx, resolved) {
				if (resolved.damageDealt > 0 && ctx.self.hp > 0) {
					ctx.self.flags.blessingVeilActive = true;
				}
			},
		},
	],
	[
		'sky_sovereign',
		{
			prepareIncomingHit(ctx, hit, _params) {
				if (!ctx.self.flags.blessingSovereignUsed) {
					ctx.self.flags.blessingSovereignUsed = true;
					hit.reductionFraction = Math.max(
						hit.reductionFraction,
						BLESSINGS.sky_sovereign.value * immunityMultiplier(ctx.self),
					);
					ctx.log(COMBAT_BLESSING_SKY_SOVEREIGN(combatDisplayName(ctx.self)));
				}
			},
		},
	],
	[
		'guardian_light',
		{
			onRoundEnd(ctx, params) {
				if (ctx.self.hp > 0) {
					const healed = cappedHeal(
						ctx.self,
						Math.floor(ctx.self.maxHp * BLESSINGS.guardian_light.value * params.strength),
					);
					if (healed > 0) {
						ctx.log(COMBAT_BLESSING_GUARDIAN_LIGHT(combatDisplayName(ctx.self), formatNumber(healed)));
					}
				}
			},
		},
	],
];

/** Fresh registry over the built-in table (plus optional extras). */
export function createBlessingEffectRegistry(
	entries: ReadonlyArray<readonly [string, BlessingEffectHandler]> = DEFAULT_BLESSING_EFFECT_ENTRIES,
): EffectRegistry<string, BlessingEffectParams> {
	return new EffectRegistry(entries);
}
