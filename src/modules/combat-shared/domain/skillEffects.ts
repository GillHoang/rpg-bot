import type { StrategyHooks } from './EffectRegistry.js';
import type { SkillDef } from '../../../shared/config/skills.js';
import { SKILL_NAMES } from '../../../shared/ui/text/skills.js';
import { EffectRegistry } from './EffectRegistry.js';
import { applyDebuff, cappedHeal, cleanseDebuffs, combatDisplayName, grantShield } from './CombatantState.js';
import { formatNumber } from '../../../shared/ui/text/format.js';

/**
 * Phase 2 skill effects — one handler per skill key, same OCP shape as
 * runeEffects/blessingEffects/weaponPassives: adding a skill = appending one
 * entry + a SKILL_DEFS row, never editing a decorator or the engine.
 *
 * Mechanisms allowed (no new battle flags): hit riders (prepareOutgoingHit),
 * landed-only effects (onHitLanded), and cast-always sustain (also in
 * prepareOutgoingHit — it runs before the miss roll, so heal/shield/cleanse
 * land even when the strike itself misses).
 */

const skillName = (key: string): string => SKILL_NAMES[key] ?? key;

export const SKILL_EFFECT_ENTRIES: ReadonlyArray<readonly [string, StrategyHooks<SkillDef>]> = [
	// ── Swordsman ──
	[
		'rend',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 30;
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} xé toạc ${combatDisplayName(ctx.enemy)}!`,
				);
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
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} gầm vang!` +
						(cleansed ? ` Xóa ${cleansed} hiệu ứng.` : '') +
						(healed ? ` Hồi ${formatNumber(healed)} HP.` : ''),
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
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} kết liễu ${combatDisplayName(ctx.enemy)}!`,
				);
			},
		},
	],
	[
		'bloodlust',
		{
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				const healed = cappedHeal(ctx.self, Math.floor(resolved.damageDealt * 0.25));
				if (healed > 0) ctx.log(`${combatDisplayName(ctx.self)} hút ${formatNumber(healed)} HP!`);
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
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} phá giáp ${combatDisplayName(ctx.enemy)}!`,
				);
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
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} cuồng nộ!`);
			},
		},
	],
	[
		'stomp',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} dậm đất rung chuyển!`);
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
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} sôi máu!` +
						(healed ? ` Hồi ${formatNumber(healed)} HP.` : ''),
				);
			},
		},
	],
	// ── Mage ──
	[
		'fireball',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 50;
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} phóng cầu lửa!`);
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
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} bắn tên băng!`);
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
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} bùng nổ ma thuật!`);
			},
		},
	],
	[
		'manashield',
		{
			prepareOutgoingHit(ctx, _hit, skill) {
				const granted = grantShield(ctx.self, Math.floor(ctx.self.maxHp * 0.2));
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} dựng khiên mana!` +
						(granted ? ` Chặn ${formatNumber(granted)} damage.` : ''),
				);
			},
		},
	],
	// ── Knight ──
	[
		'smite',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 35;
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} trừng phạt ${combatDisplayName(ctx.enemy)}!`,
				);
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
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} hiệu triệu!` +
						(healed ? ` Hồi ${formatNumber(healed)} HP.` : '') +
						(cleansed ? ` Xóa ${cleansed} hiệu ứng.` : ''),
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
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} dựng tường khiên!` +
						(granted ? ` Chặn ${formatNumber(granted)} damage.` : '') +
						(healed ? ` Hồi ${formatNumber(healed)} HP.` : ''),
				);
			},
		},
	],
	[
		'retribution',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 60;
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} báo ứng!`);
			},
			onHitLanded(ctx, resolved) {
				if (resolved.damageDealt <= 0) return;
				const healed = cappedHeal(ctx.self, Math.floor(resolved.damageDealt * 0.3));
				if (healed > 0) ctx.log(`${combatDisplayName(ctx.self)} hồi ${formatNumber(healed)} HP từ báo ứng!`);
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
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} ngắm bắn ${combatDisplayName(ctx.enemy)}!`,
				);
			},
		},
	],
	[
		'volley',
		{
			prepareOutgoingHit(ctx, hit, skill) {
				hit.damagePctBonus += 10;
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} xả mưa tên!`);
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
				ctx.log(`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} giăng bẫy rễ!`);
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
				ctx.log(
					`**${skillName(skill.key)}** — ${combatDisplayName(ctx.self)} băng bó!` +
						(healed ? ` Hồi ${formatNumber(healed)} HP.` : ''),
				);
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
