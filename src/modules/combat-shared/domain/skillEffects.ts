import type { StrategyHooks } from './EffectRegistry.js';
import type { StrategyContext } from './IClassStrategy.js';
import type { SkillDef } from '../../../shared/config/skills.js';
import { SKILL_NAMES } from '../../../shared/ui/text/skills.js';
import {
	SKILL_CAST,
	SKILL_CLEANSED,
	SKILL_HEALED,
	SKILL_SHIELDED,
} from '../../../shared/ui/text/skills.js';
import { EffectRegistry } from './EffectRegistry.js';
import {
	applyDebuff,
	cappedHeal,
	cleanseDebuffs,
	combatDisplayName,
	grantShield,
} from './CombatantState.js';
import { formatNumber } from '../../../shared/ui/text/format.js';

/**
 * Phase 2 skill effects — one handler per skill key, same OCP shape as
 * runeEffects/blessingEffects/weaponPassives: adding a skill = appending one
 * entry + a SKILL_DEFS row, never editing a decorator or the engine.
 *
 * Mechanisms allowed (no new battle flags): hit riders (prepareOutgoingHit),
 * landed-only effects (onHitLanded), and cast-always sustain (also in
 * prepareOutgoingHit — it runs before the miss roll, so heal/shield/cleanse
 * land even when the strike itself misses). All wording via text/skills.ts.
 */

const skillName = (key: string): string => SKILL_NAMES[key] ?? key;
const castOn = (ctx: StrategyContext, key: string): string =>
	SKILL_CAST(skillName(key), combatDisplayName(ctx.self), combatDisplayName(ctx.enemy));
const castSelf = (ctx: StrategyContext, key: string): string =>
	SKILL_CAST(skillName(key), combatDisplayName(ctx.self), null);

export const SKILL_EFFECT_ENTRIES: ReadonlyArray<readonly [string, StrategyHooks<SkillDef>]> = [
	// ── Swordsman ──
	[
		'rend',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 30;
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				const value = Math.max(5, Math.floor(ctx.enemy.maxHp * 0.06));
				applyDebuff(ctx.enemy, { tag: 'bleed', turnsLeft: 2, value }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'warcry',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				const cleansed = cleanseDebuffs(ctx.self, 2);
				const healed = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * 0.03));
				ctx.log(
					castSelf(ctx, skill.key) +
						(cleansed ? SKILL_CLEANSED(cleansed) : '') +
						(healed ? SKILL_HEALED(formatNumber(healed)) : ''),
				);
			},
		},
	],
	[
		'execute',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				const missingFrac = 1 - ctx.enemy.hp / ctx.enemy.maxHp;
				hit.damagePctBonus += 20 + Math.floor(80 * missingFrac);
				ctx.log(castOn(ctx, skill.key));
			},
		},
	],
	[
		'bloodlust',
		{
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				const healed = cappedHeal(ctx.self, Math.floor(resolved.damageDealt * 0.25));
				if (healed > 0) ctx.log(castOn(ctx, 'bloodlust') + SKILL_HEALED(formatNumber(healed)));
			},
		},
	],
	// ── Fighter ──
	[
		'sunder',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 15;
				hit.armorPierceFraction += 0.2;
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				applyDebuff(ctx.enemy, { tag: 'def_down', turnsLeft: 2, value: 0.15 }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'frenzy',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 80;
				ctx.log(castOn(ctx, skill.key));
			},
		},
	],
	[
		'stomp',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				applyDebuff(ctx.enemy, { tag: 'dizzy', turnsLeft: 1, value: 0.25 }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'bloodboil',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				const healed = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * 0.1));
				ctx.log(castSelf(ctx, skill.key) + (healed ? SKILL_HEALED(formatNumber(healed)) : ''));
			},
		},
	],
	// ── Mage ──
	[
		'fireball',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 50;
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				const value = Math.max(5, Math.floor(ctx.enemy.maxHp * 0.05));
				applyDebuff(ctx.enemy, { tag: 'burn', turnsLeft: 2, value }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'frostbolt',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 15;
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				applyDebuff(ctx.enemy, { tag: 'slow', turnsLeft: 2, value: 0.25 }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'surge',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.forcedMultiplier = Math.max(hit.forcedMultiplier ?? 0, 2.4);
				hit.suppressCrit = true;
				ctx.log(castOn(ctx, skill.key));
			},
		},
	],
	[
		'manashield',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				const granted = grantShield(ctx.self, Math.floor(ctx.self.maxHp * 0.2));
				ctx.log(castSelf(ctx, skill.key) + (granted ? SKILL_SHIELDED(formatNumber(granted)) : ''));
			},
		},
	],
	// ── Knight ──
	[
		'smite',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 35;
				ctx.log(castOn(ctx, skill.key));
			},
		},
	],
	[
		'rally',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				const cleansed = cleanseDebuffs(ctx.self, 1);
				const healed = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * 0.07));
				ctx.log(
					castSelf(ctx, skill.key) +
						(healed ? SKILL_HEALED(formatNumber(healed)) : '') +
						(cleansed ? SKILL_CLEANSED(cleansed) : ''),
				);
			},
		},
	],
	[
		'aegiswall',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				const granted = grantShield(ctx.self, Math.floor(ctx.self.maxHp * 0.12));
				const healed = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * 0.04));
				ctx.log(
					castSelf(ctx, skill.key) +
						(granted ? SKILL_SHIELDED(formatNumber(granted)) : '') +
						(healed ? SKILL_HEALED(formatNumber(healed)) : ''),
				);
			},
		},
	],
	[
		'retribution',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 60;
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				const healed = cappedHeal(ctx.self, Math.floor(resolved.damageDealt * 0.3));
				if (healed > 0) ctx.log(castOn(ctx, 'retribution') + SKILL_HEALED(formatNumber(healed)));
			},
		},
	],
	// ── Archer ──
	[
		'aimed',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 25;
				hit.armorPierceFraction += 0.15;
				ctx.log(castOn(ctx, skill.key));
			},
		},
	],
	[
		'volley',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 10;
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(_ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				resolved.triggerExtraAttack = true;
			},
		},
	],
	[
		'snare',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 10;
				ctx.log(castOn(ctx, skill.key));
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				applyDebuff(ctx.enemy, { tag: 'slow', turnsLeft: 2, value: 0.3 }, ctx.rng, ctx.log);
			},
		},
	],
	[
		'fielddressing',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				const healed = cappedHeal(ctx.self, Math.floor(ctx.self.maxHp * 0.06));
				ctx.log(castSelf(ctx, skill.key) + (healed ? SKILL_HEALED(formatNumber(healed)) : ''));
			},
		},
	],
];

export function createSkillRegistry(
	entries: ReadonlyArray<readonly [string, StrategyHooks<SkillDef>]> = SKILL_EFFECT_ENTRIES,
): EffectRegistry<string, SkillDef> {
	return new EffectRegistry<string, SkillDef>(entries);
}

export function getSkillHandler(
	handlers: EffectRegistry<string, SkillDef>,
	key: string,
): StrategyHooks<SkillDef> | undefined {
	return handlers.get(key);
}
