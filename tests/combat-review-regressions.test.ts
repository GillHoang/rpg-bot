import { describe, expect, it, vi } from 'vitest';
import { BattleAttackResolver } from '../src/domain/combat/BattleAttack.js';
import { CombatStatusEffectProcessor } from '../src/domain/combat/CombatStatusEffects.js';
import { createCombatant, type DebuffTag } from '../src/domain/combat/CombatantState.js';
import { DeityBlessingDecorator } from '../src/domain/combat/DeityBlessingDecorator.js';
import { wrapWithRunes } from '../src/domain/combat/RuneStrategyDecorator.js';
import { ArcherStrategy } from '../src/domain/combat/classes/ArcherStrategy.js';
import { FighterStrategy } from '../src/domain/combat/classes/FighterStrategy.js';
import { MonsterStrategy } from '../src/domain/combat/classes/MonsterStrategy.js';
import { NullClassStrategy } from '../src/domain/combat/classes/NullClassStrategy.js';
import { combatTag, COMBAT_TAGS } from '../src/text/combat.js';

function setup() {
	const make = (name: string) => createCombatant({ name, combatClass: null, hp: 1000, atk: 100, def: 0, crit: 0 });
	return { self: make('Attacker'), enemy: make('Defender'), round: 1, rng: vi.fn(() => 0), log: vi.fn() };
}

describe('combat review regressions', () => {
	it.each([
		{ archer: false, runes: 1, pierce: 0.15 },
		{ archer: true, runes: 0, pierce: 0.25 },
		{ archer: true, runes: 1, pierce: 0.4 },
		{ archer: true, runes: 2, pierce: 0.55 },
		{ archer: false, runes: 2, pierce: 0.3 },
		{ archer: true, runes: 6, pierce: 1 },
	])('Piercing stacks and caps at 100%: $archer Archer, $runes runes', ({ archer, runes, pierce }) => {
		const ctx = setup();
		ctx.enemy.def = 1200;
		ctx.rng.mockReturnValue(0.5); // Fixed variance, no crit or Archer follow-up.
		const strategy = wrapWithRunes(
			archer ? new ArcherStrategy() : new NullClassStrategy(),
			Array.from({ length: runes }, () => ({ effectKey: 'piercing' as const, value: 0.15 })),
		);
		const hit = { damagePctBonus: 0, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false };
		strategy.prepareOutgoingHit(ctx, hit);
		expect(hit.armorPierceFraction).toBeCloseTo(pierce);
		new BattleAttackResolver().executeStrike(ctx.self, ctx.enemy, strategy, new NullClassStrategy(), ctx);
		expect(ctx.enemy.hp).toBe(1000 - Math.floor(100 / (2 - pierce)));
	});

	it.each([
		[400, 90],
		[399, 125],
	])('blood frenzy at %i HP deals %i damage', (hp, damage) => {
		const ctx = setup();
		ctx.self.hp = hp;
		new BattleAttackResolver().executeStrike(
			ctx.self,
			ctx.enemy,
			new MonsterStrategy('blood_frenzy'),
			new NullClassStrategy(),
			ctx,
		);
		expect(ctx.enemy.hp).toBe(1000 - damage);
	});

	it.each([0.14, 0.16])('Bash Dizzy survives stun and is consumed on the first free turn (roll %s)', (roll) => {
		const ctx = setup();
		const statuses = new CombatStatusEffectProcessor();
		new BattleAttackResolver().executeStrike(
			ctx.self,
			ctx.enemy,
			new FighterStrategy(),
			new NullClassStrategy(),
			ctx,
		);
		statuses.applyEndOfRoundEffects(ctx.enemy, new Set(), []);
		const rng = vi.fn(() => roll);
		expect(statuses.isTurnDisabled(ctx.enemy, rng, [])).toBe(true);
		expect(rng).not.toHaveBeenCalled();
		statuses.applyEndOfRoundEffects(ctx.enemy, new Set(ctx.enemy.debuffs), []);
		expect(ctx.enemy.debuffs.map((d) => d.tag)).toEqual(['dizzy']);
		expect(statuses.isTurnDisabled(ctx.enemy, rng, [])).toBe(roll < 0.15);
		expect(rng).toHaveBeenCalledTimes(1);
		expect(ctx.enemy.debuffs).toEqual([]);
		expect(statuses.isTurnDisabled(ctx.enemy, rng, [])).toBe(false);
	});

	it.each([
		[1, 910],
		[1000, 820],
	])('Archer at %i HP only follows up if it survives thorns', (hp, remaining) => {
		const ctx = setup();
		ctx.self.hp = hp;
		const defender = wrapWithRunes(new NullClassStrategy(), [{ effectKey: 'thorns', value: 0.15 }]);
		new BattleAttackResolver().executeStrike(ctx.self, ctx.enemy, new ArcherStrategy(), defender, ctx);
		expect(ctx.enemy.hp).toBe(remaining);
		expect(ctx.self.hp).toBe(hp === 1 ? 0 : 974);
	});

	it.each(['bleed', 'burn', 'venom'] as DebuffTag[])('%s expires even when its damage rounds to zero', (tag) => {
		for (const [value, warding] of [
			[0, 0],
			[1, 0.25],
			[10, 1],
		]) {
			const ctx = setup();
			ctx.self.flags.warding_pct = warding;
			ctx.self.debuffs.push({ tag, value, turnsLeft: 2 });
			const statuses = new CombatStatusEffectProcessor();
			const log: string[] = [];
			statuses.applyEndOfRoundEffects(ctx.self, new Set(ctx.self.debuffs), log);
			expect(ctx.self.debuffs[0].turnsLeft).toBe(1);
			statuses.applyEndOfRoundEffects(ctx.self, new Set(ctx.self.debuffs), log);
			expect(ctx.self.debuffs).toEqual([]);
			expect(ctx.self.hp).toBe(1000);
			expect(log).toEqual([]);
		}
	});

	it.each([
		[0.15, 0.25],
		[0.25, 0.15],
	])('Warding uses the strongest rune in either order (%s, %s)', (first, second) => {
		const ctx = setup();
		const strategy = wrapWithRunes(
			new NullClassStrategy(),
			[first, second].map((value) => ({ effectKey: 'warding', value })),
		);
		for (let round = 1; round <= 2; round++) {
			ctx.round = round;
			strategy.onRoundStart(ctx);
			const hit = { reductionFraction: 0 };
			strategy.prepareIncomingHit(ctx, hit);
			expect(hit.reductionFraction).toBe(0.25);
			ctx.self.debuffs.push({ tag: 'venom', value: 100, turnsLeft: 1 });
			new CombatStatusEffectProcessor().applyEndOfRoundEffects(ctx.self, new Set(), []);
			expect(ctx.self.hp).toBe(1000 - 75 * round);
		}
	});

	it.each([true, false])(
		'Moon Devourer only rolls and labels crit when its multiplier is inactive (%s)',
		(active) => {
			const ctx = setup();
			ctx.self.crit = 100;
			ctx.rng.mockReturnValueOnce(active ? 0 : 0.99);
			const strategy = new DeityBlessingDecorator(new NullClassStrategy(), 'moon_devourer', 1);
			new BattleAttackResolver().executeStrike(ctx.self, ctx.enemy, strategy, new NullClassStrategy(), ctx);
			expect(ctx.enemy.hp).toBe(820);
			expect(ctx.rng).toHaveBeenCalledTimes(active ? 2 : 3);
			expect(ctx.log.mock.calls.some(([line]) => line.includes(combatTag(COMBAT_TAGS.CRIT)))).toBe(!active);
		},
	);
});
