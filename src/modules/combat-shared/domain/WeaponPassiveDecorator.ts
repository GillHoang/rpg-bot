import { formatNumber } from '../../../shared/ui/text/format.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
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

/**
 * OwO-style weapon passive decorator.
 *
 * Same architecture as RuneStrategyDecorator/DeityBlessingDecorator: wraps any
 * IClassStrategy (chainable with rune/blessing decorators) and layers ONE
 * equipped weapon's `passiveKey` on top, without class strategies knowing
 * weapons exist. Applies to both sides of PvE and PvP since every service
 * resolves through the shared BattleEngine.
 */
export class WeaponPassiveDecorator implements IClassStrategy {
	readonly key: IClassStrategy['key'];

	constructor(
		private readonly inner: IClassStrategy,
		private readonly passiveKey: string,
	) {
		this.key = inner.key;
	}

	onRoundStart(ctx: StrategyContext): void {
		this.inner.onRoundStart(ctx);
	}

	prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		this.inner.prepareOutgoingHit(ctx, hit);
		switch (this.passiveKey) {
			case 'warlord_edge':
				if (ctx.enemy.maxHp > ctx.self.maxHp) {
					hit.damagePctBonus += 5;
					ctx.log(COMBAT_WEAPON_WARLORD_EDGE(combatDisplayName(ctx.self)));
				}
				break;
			case 'first_blood':
				if (!ctx.self.flags.weapon_first_blood_used) {
					hit.damagePctBonus += 10;
					ctx.self.flags.weapon_first_blood_used = true;
					ctx.log(COMBAT_WEAPON_FIRST_BLOOD(combatDisplayName(ctx.self)));
				}
				break;
			case 'sky_dive':
				// Crit is rolled from attacker.crit after this hook; bump now and
				// restore in onHitLanded (both hit and miss paths call it once).
				if (ctx.self.hp >= ctx.self.maxHp) {
					ctx.self.crit += 8;
					ctx.self.flags.weapon_sky_dive_bonus = 8;
					ctx.log(COMBAT_WEAPON_SKY_DIVE(combatDisplayName(ctx.self)));
				}
				break;
			case 'eclipse_mark':
				if ((ctx.enemy.flags.eclipse_mark_until as number) >= ctx.round) {
					hit.damagePctBonus += 15;
					ctx.log(COMBAT_WEAPON_ECLIPSE_MARK(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
				}
				break;
			case 'eagle_dive':
				if (ctx.round === 1) {
					hit.damagePctBonus += 10;
					ctx.log(COMBAT_WEAPON_EAGLE_DIVE(combatDisplayName(ctx.self)));
				}
				break;
			case 'storm_echo':
				if (ctx.self.flags.storm_echo_armed) {
					ctx.self.flags.storm_echo_armed = false;
					hit.damagePctBonus += 25;
					ctx.log(COMBAT_WEAPON_STORM_ECHO(combatDisplayName(ctx.self)));
				}
				break;
			case 'soul_weigh': {
				const missing = 1 - ctx.enemy.hp / ctx.enemy.maxHp;
				if (missing > 0) {
					const bonus = Math.round(20 * missing);
					hit.damagePctBonus += bonus;
					ctx.log(COMBAT_WEAPON_SOUL_WEIGH(combatDisplayName(ctx.self), bonus));
				}
				break;
			}
			case 'grass_cleaver':
				hit.damagePctBonus += 10;
				ctx.log(COMBAT_WEAPON_GRASS_CLEAVER(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
				break;
			case 'oath_pierce':
				hit.armorPierceFraction = Math.min(1, hit.armorPierceFraction + 0.3);
				ctx.log(COMBAT_WEAPON_OATH_PIERCE(combatDisplayName(ctx.self)));
				break;
			case 'sky_sunder':
				hit.damagePctBonus += 15;
				hit.armorPierceFraction = Math.min(1, hit.armorPierceFraction + 0.1);
				ctx.log(COMBAT_WEAPON_SKY_SUNDER(combatDisplayName(ctx.self)));
				break;
			default:
				break;
		}
	}

	prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		this.inner.prepareIncomingHit(ctx, hit);
	}

	onHitLanded(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onHitLanded(ctx, resolved);
		const skyDiveBonus = (ctx.self.flags.weapon_sky_dive_bonus as number) ?? 0;
		if (skyDiveBonus > 0) {
			ctx.self.crit -= skyDiveBonus;
			ctx.self.flags.weapon_sky_dive_bonus = 0;
		}
		if (resolved.missed || resolved.damageDealt <= 0) return;
		switch (this.passiveKey) {
			case 'eclipse_mark':
				if (resolved.crit) {
					ctx.enemy.flags.eclipse_mark_until = ctx.round + 2;
					ctx.log(COMBAT_WEAPON_ECLIPSE_MARK(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
				}
				break;
			case 'twin_sting':
				if (rollChance(0.15, ctx.rng)) {
					resolved.triggerExtraAttack = true;
					ctx.log(COMBAT_WEAPON_TWIN_STING(combatDisplayName(ctx.self)));
				}
				break;
			case 'storm_echo':
				if (resolved.crit) ctx.self.flags.storm_echo_armed = true;
				break;
			case 'grass_cleaver':
				applyDebuff(ctx.enemy, { tag: 'def_down', turnsLeft: 2, value: 0.1 }, ctx.rng, ctx.log);
				break;
			default:
				break;
		}
	}

	onDamageTaken(ctx: StrategyContext, resolved: ResolvedHit): void {
		this.inner.onDamageTaken(ctx, resolved);
	}

	onRoundEnd(ctx: StrategyContext): void {
		this.inner.onRoundEnd(ctx);
		if (this.passiveKey === 'solar_barque' && ctx.self.hp > 0) {
			const healed = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * 0.02));
			if (healed > 0) {
				ctx.log(COMBAT_WEAPON_SOLAR_BARQUE(combatDisplayName(ctx.self), formatNumber(healed)));
			}
		}
	}
}

/** Wraps a strategy with the equipped weapon's passive; 'none'/missing is a no-op. */
export function wrapWithWeaponPassive(base: IClassStrategy, passiveKey: string | null | undefined): IClassStrategy {
	if (!passiveKey || passiveKey === 'none') return base;
	return new WeaponPassiveDecorator(base, passiveKey);
}
