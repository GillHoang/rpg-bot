import { formatNumber } from '../../../shared/ui/text/format.js';
import { applyDebuff, cappedHeal, combatDisplayName } from './CombatantState.js';
import { rollChance } from '../../../shared/utils/weightedRandom.js';
import {
	COMBAT_WEAPON_EAGLE_DIVE,
	COMBAT_WEAPON_ECLIPSE_MARK,
	COMBAT_WEAPON_FIRST_BLOOD,
	COMBAT_WEAPON_GRASS_CLEAVER,
	COMBAT_WEAPON_OATH_PIERCE,
	COMBAT_WEAPON_SKY_DIVE,
	COMBAT_WEAPON_SKY_SUNDER,
	COMBAT_WEAPON_SOLAR_BARQUE,
	COMBAT_WEAPON_SOUL_WEIGH,
	COMBAT_WEAPON_STORM_ECHO,
	COMBAT_WEAPON_TWIN_STING,
	COMBAT_WEAPON_WARLORD_EDGE,
} from '../../../shared/ui/text/combat.js';
import { EffectRegistry, type StrategyHooks } from './EffectRegistry.js';

/** Key-only effect: tuning lives in the key itself, so params are unused. */
export type WeaponPassiveHandler = StrategyHooks<undefined>;

/**
 * Built-in weapon passive table, transcribed 1:1 from the former
 * `WeaponPassiveDecorator` switch. Adding a passive = appending one entry;
 * the decorator core never changes.
 */
export const DEFAULT_WEAPON_PASSIVE_ENTRIES: ReadonlyArray<readonly [string, WeaponPassiveHandler]> = [
	[
		'warlord_edge',
		{
			prepareOutgoingHit(ctx, hit) {
				if (ctx.enemy.maxHp > ctx.self.maxHp) {
					hit.damagePctBonus += 5;
					ctx.log(COMBAT_WEAPON_WARLORD_EDGE(combatDisplayName(ctx.self)));
				}
			},
		},
	],
	[
		'first_blood',
		{
			prepareOutgoingHit(ctx, hit) {
				if (!ctx.self.flags.weaponFirstBloodUsed) {
					hit.damagePctBonus += 10;
					ctx.self.flags.weaponFirstBloodUsed = true;
					ctx.log(COMBAT_WEAPON_FIRST_BLOOD(combatDisplayName(ctx.self)));
				}
			},
		},
	],
	[
		'sky_dive',
		{
			prepareOutgoingHit(ctx, _hit) {
				// Crit is rolled from attacker.crit after this hook; bump now and
				// restore in onHitLandedAlways (both hit and miss paths run it once).
				if (ctx.self.hp >= ctx.self.maxHp) {
					ctx.self.crit += 8;
					ctx.self.flags.weaponSkyDiveBonus = 8;
					ctx.log(COMBAT_WEAPON_SKY_DIVE(combatDisplayName(ctx.self)));
				}
			},
			onHitLandedAlways(ctx) {
				const skyDiveBonus = ctx.self.flags.weaponSkyDiveBonus;
				if (skyDiveBonus > 0) {
					ctx.self.crit -= skyDiveBonus;
					ctx.self.flags.weaponSkyDiveBonus = 0;
				}
			},
		},
	],
	[
		'eclipse_mark',
		{
			prepareOutgoingHit(ctx, hit) {
				if (ctx.enemy.flags.eclipseMarkUntil >= ctx.round) {
					hit.damagePctBonus += 15;
					ctx.log(COMBAT_WEAPON_ECLIPSE_MARK(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
				}
			},
			onHitLanded(ctx, resolved) {
				if (resolved.crit) {
					ctx.enemy.flags.eclipseMarkUntil = ctx.round + 2;
					ctx.log(COMBAT_WEAPON_ECLIPSE_MARK(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
				}
			},
		},
	],
	[
		'eagle_dive',
		{
			prepareOutgoingHit(ctx, hit) {
				if (ctx.round === 1) {
					hit.damagePctBonus += 10;
					ctx.log(COMBAT_WEAPON_EAGLE_DIVE(combatDisplayName(ctx.self)));
				}
			},
		},
	],
	[
		'storm_echo',
		{
			prepareOutgoingHit(ctx, hit) {
				if (ctx.self.flags.stormEchoArmed) {
					ctx.self.flags.stormEchoArmed = false;
					hit.damagePctBonus += 25;
					ctx.log(COMBAT_WEAPON_STORM_ECHO(combatDisplayName(ctx.self)));
				}
			},
			onHitLanded(ctx, resolved) {
				if (resolved.crit) ctx.self.flags.stormEchoArmed = true;
			},
		},
	],
	[
		'soul_weigh',
		{
			prepareOutgoingHit(ctx, hit) {
				const missing = 1 - ctx.enemy.hp / ctx.enemy.maxHp;
				if (missing > 0) {
					const bonus = Math.round(20 * missing);
					hit.damagePctBonus += bonus;
					ctx.log(COMBAT_WEAPON_SOUL_WEIGH(combatDisplayName(ctx.self), bonus));
				}
			},
		},
	],
	[
		'grass_cleaver',
		{
			prepareOutgoingHit(ctx, hit) {
				hit.damagePctBonus += 10;
				ctx.log(COMBAT_WEAPON_GRASS_CLEAVER(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
			},
			onHitLanded(ctx) {
				applyDebuff(ctx.enemy, { tag: 'def_down', turnsLeft: 2, value: 0.1 }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'oath_pierce',
		{
			prepareOutgoingHit(ctx, hit) {
				hit.armorPierceFraction = Math.min(1, hit.armorPierceFraction + 0.3);
				ctx.log(COMBAT_WEAPON_OATH_PIERCE(combatDisplayName(ctx.self)));
			},
		},
	],
	[
		'sky_sunder',
		{
			prepareOutgoingHit(ctx, hit) {
				hit.damagePctBonus += 15;
				hit.armorPierceFraction = Math.min(1, hit.armorPierceFraction + 0.1);
				ctx.log(COMBAT_WEAPON_SKY_SUNDER(combatDisplayName(ctx.self)));
			},
		},
	],
	[
		'twin_sting',
		{
			onHitLanded(ctx, resolved) {
				if (rollChance(0.15, ctx.rng)) {
					resolved.triggerExtraAttack = true;
					ctx.log(COMBAT_WEAPON_TWIN_STING(combatDisplayName(ctx.self)));
				}
			},
		},
	],
	[
		'solar_barque',
		{
			onRoundEnd(ctx) {
				if (ctx.self.hp > 0) {
					const healed = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * 0.02));
					if (healed > 0) {
						ctx.log(COMBAT_WEAPON_SOLAR_BARQUE(combatDisplayName(ctx.self), formatNumber(healed)));
					}
				}
			},
		},
	],
];

/** Fresh registry over the built-in table (plus optional extras). */
export function createWeaponPassiveRegistry(
	entries: ReadonlyArray<readonly [string, WeaponPassiveHandler]> = DEFAULT_WEAPON_PASSIVE_ENTRIES,
): EffectRegistry<string, undefined> {
	return new EffectRegistry(entries);
}
