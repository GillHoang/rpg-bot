import { formatNumber } from '../../../shared/ui/text/format.js';
import { combatDisplayName, findDebuff, applyDebuff, cappedHeal, immunityMultiplier } from './CombatantState.js';
import {
	COMBAT_FROST,
	COMBAT_RUNE_THORNS,
	COMBAT_RUNE_VAMPIRIC,
	COMBAT_RUNE_VENOM,
} from '../../../shared/ui/text/combat.js';
import { EffectRegistry, type StrategyHooks } from './EffectRegistry.js';

/** Per-instance tuning: the socketed fraction from rune_roster. */
export interface RuneEffectParams {
	value: number;
}

export type RuneEffectHandler = StrategyHooks<RuneEffectParams>;

/**
 * Built-in rune combat-hook table, transcribed 1:1 from the former
 * `RuneStrategyDecorator` if-chain. Stat-% runes (sharpness/…) are not here:
 * they apply once at assembly time (see StatAssemblyService).
 */
export const DEFAULT_RUNE_EFFECT_ENTRIES: ReadonlyArray<readonly [string, RuneEffectHandler]> = [
	[
		'warding',
		{
			onRoundStart(ctx, params) {
				ctx.self.flags.wardingPct = Math.max(params.value, ctx.self.flags.wardingPct);
			},
			prepareIncomingHit(_ctx, hit, params) {
				hit.reductionFraction = Math.max(hit.reductionFraction, params.value);
			},
		},
	],
	[
		'piercing',
		{
			prepareOutgoingHit(_ctx, hit, params) {
				hit.armorPierceFraction = Math.min(1, hit.armorPierceFraction + params.value);
			},
		},
	],
	[
		'aegis_rune',
		{
			prepareIncomingHit(ctx, hit) {
				if (!ctx.self.flags.aegisUsed) {
					hit.reductionFraction = Math.max(hit.reductionFraction, immunityMultiplier(ctx.self));
					ctx.self.flags.aegisUsed = true;
				}
			},
		},
	],
	[
		'vampiric',
		{
			onHitLanded(ctx, resolved, params) {
				const healed = cappedHeal(ctx.self, Math.floor(resolved.damageDealt * params.value));
				if (healed > 0) {
					ctx.log(COMBAT_RUNE_VAMPIRIC(combatDisplayName(ctx.self), formatNumber(healed)));
				}
			},
		},
	],
	[
		'venom',
		{
			onHitLanded(ctx, _resolved, params) {
				const value = Math.floor(ctx.enemy.maxHp * params.value);
				const existing = findDebuff(ctx.enemy, 'venom');
				if (existing) {
					existing.turnsLeft = 2;
					// P5 cap: stacked venom never exceeds 25% of the victim's max HP.
					existing.value = Math.min(Math.floor(ctx.enemy.maxHp * 0.25), existing.value + value);
				} else {
					applyDebuff(ctx.enemy, { tag: 'venom', turnsLeft: 2, value }, ctx.rng, ctx.log);
				}
				ctx.log(
					COMBAT_RUNE_VENOM(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy), formatNumber(value)),
				);
			},
		},
	],
	[
		'blight',
		{
			onHitLanded(ctx, _resolved, params) {
				const existing = findDebuff(ctx.enemy, 'blight');
				if (existing) {
					existing.value = Math.max(existing.value, params.value);
					existing.turnsLeft = 1;
				} else applyDebuff(ctx.enemy, { tag: 'blight', turnsLeft: 1, value: params.value }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'frost',
		{
			onHitLanded(ctx, _resolved, params) {
				applyDebuff(ctx.enemy, { tag: 'slow', turnsLeft: 1, value: params.value }, ctx.rng, ctx.log);
				ctx.log(COMBAT_FROST(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
			},
		},
	],
	[
		'thorns',
		{
			onDamageTaken(ctx, resolved, params) {
				if (resolved.damageDealt > 0) {
					const reflected = Math.floor(resolved.damageDealt * params.value);
					if (reflected > 0) {
						ctx.enemy.hp = Math.max(0, ctx.enemy.hp - reflected);
						ctx.log(COMBAT_RUNE_THORNS(combatDisplayName(ctx.self), formatNumber(reflected)));
					}
				}
			},
		},
	],
];

/** Fresh registry over the built-in table (plus optional extras). */
export function createRuneEffectRegistry(
	entries: ReadonlyArray<readonly [string, RuneEffectHandler]> = DEFAULT_RUNE_EFFECT_ENTRIES,
): EffectRegistry<string, RuneEffectParams> {
	return new EffectRegistry(entries);
}
