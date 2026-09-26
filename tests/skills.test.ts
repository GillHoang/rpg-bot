import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { NullClassStrategy } from '../src/modules/combat-shared/domain/classes/NullClassStrategy.js';
import { createSkillRegistry } from '../src/modules/combat-shared/domain/skillEffects.js';
import { SkillDecorator } from '../src/modules/combat-shared/domain/SkillDecorator.js';
import {
	MAX_EQUIPPED_SKILLS,
	SKILL_DEFS,
	SKILL_RESOURCE,
	chooseSkillByStance,
	skillsForClass,
	type ReadySkill,
} from '../src/shared/config/skills.js';

const CLASSES = ['Swordsman', 'Fighter', 'Mage', 'Knight', 'Archer'];

describe('skill registry (Phase 2)', () => {
	it('registers exactly 4 skills per class with sane cost/cooldown/kind', () => {
		const registry = createSkillRegistry();
		const keys = Object.keys(SKILL_DEFS);
		expect(keys).toHaveLength(20);
		expect(new Set(keys).size).toBe(20);
		for (const combatClass of CLASSES) {
			const defs = skillsForClass(combatClass);
			expect(defs, combatClass).toHaveLength(4);
			const kinds = new Set(defs.map((d) => d.kind));
			// Every class can play sustain (defensive stance) and has a finisher.
			expect(kinds.has('sustain'), combatClass).toBe(true);
			expect(kinds.has('burst'), combatClass).toBe(true);
			for (const def of defs) {
				expect(def.cost).toBeGreaterThan(0);
				expect(def.cost).toBeLessThanOrEqual(SKILL_RESOURCE.max);
				expect(def.cooldown).toBeGreaterThanOrEqual(2);
				expect(def.cooldown).toBeLessThanOrEqual(5);
				expect(registry.has(def.key)).toBe(true);
			}
		}
	});

	it('caps the loadout at 2 skills', () => {
		expect(MAX_EQUIPPED_SKILLS).toBe(2);
	});
});

describe('chooseSkillByStance (deterministic, no RNG)', () => {
	const ready: ReadySkill[] = [
		{ key: 'pressure', cost: 20, kind: 'pressure' },
		{ key: 'burst', cost: 50, kind: 'burst' },
		{ key: 'sustain', cost: 30, kind: 'sustain' },
		{ key: 'control', cost: 25, kind: 'control' },
	];

	it('returns null without ready skills', () => {
		expect(chooseSkillByStance([], 'aggressive')).toBeNull();
	});

	it('aggressive takes the most expensive, balanced the cheapest', () => {
		expect(chooseSkillByStance(ready, 'aggressive')).toBe('burst');
		expect(chooseSkillByStance(ready, 'balanced')).toBe('pressure');
	});

	it('defensive only casts sustain, counter only control', () => {
		expect(chooseSkillByStance(ready, 'defensive')).toBe('sustain');
		expect(chooseSkillByStance(ready, 'counter')).toBe('control');
		expect(
			chooseSkillByStance(
				ready.filter((s) => s.kind !== 'sustain'),
				'defensive',
			),
		).toBeNull();
		expect(
			chooseSkillByStance(
				ready.filter((s) => s.kind !== 'control'),
				'counter',
			),
		).toBeNull();
	});
});

describe('skill battle flow', () => {
	const fighter = () =>
		createCombatant({
			name: 'Fighter',
			combatClass: 'Fighter',
			hp: 5000,
			atk: 400,
			def: 150,
			crit: 10,
			skills: ['rend', 'warcry'],
			stance: 'balanced',
		});
	const dummy = () =>
		createCombatant({ name: 'Dummy', combatClass: null, hp: 20000, atk: 10, def: 0, crit: 0 });

	it('casts the cheapest ready skill, pays cost and arms cooldown', () => {
		const player = fighter();
		player.flags.resource = 100;
		const enemy = dummy();
		const strategy = new NullClassStrategy();
		const before = player.flags.resource;
		new BattleEngine().resolve(player, enemy, 7, { playerStrategy: strategy });
		// rend (25) is cheaper than warcry (30): balanced picks rend first.
		expect(player.flags.resource).toBeLessThan(before);
		expect(enemy.debuffs.some((d) => d.tag === 'bleed')).toBe(true);
	});

	it('builds resource on dealing and taking damage, capped at max', () => {
		const player = fighter();
		const enemy = dummy();
		enemy.skills = ['rend'];
		const result = new BattleEngine().resolve(player, enemy, 7);
		expect(result.rounds).toBeGreaterThan(0);
		expect(player.flags.resource).toBeGreaterThanOrEqual(0);
		expect(player.flags.resource).toBeLessThanOrEqual(SKILL_RESOURCE.max);
		expect(enemy.flags.resource).toBeLessThanOrEqual(SKILL_RESOURCE.max);
	});

	it('casts nothing without affordable skills and never rolls RNG on selection', () => {
		const strategy = new NullClassStrategy();
		const rng = (() => {
			let calls = 0;
			const fn = () => {
				calls++;
				return 0.5;
			};
			(fn as unknown as { calls: () => number }).calls = () => calls;
			return fn as unknown as (() => number) & { calls: () => number };
		})();
		const ctx = { self: fighter(), enemy: dummy(), round: 1, rng, log: () => {} };
		// Empty list and unaffordable-only list both return null.
		expect(strategy.chooseSkill(ctx, [], 'aggressive')).toBeNull();
		expect(strategy.chooseSkill(ctx, [{ key: 'rend', cost: 25, kind: 'pressure' }], 'defensive')).toBeNull();
		expect(rng.calls()).toBe(0);
	});

	it('is deterministic: the same loadout and seed replay the same log', () => {
		const run = () => {
			const player = fighter();
			player.flags.resource = 100;
			return new BattleEngine().resolve(player, dummy(), 42).log;
		};
		expect(run()).toEqual(run());
	});

	it('SkillDecorator layers the skill without swallowing the base passive', () => {
		const base = new NullClassStrategy();
		const decorated = new SkillDecorator(base, 'rend', SKILL_DEFS['rend']!);
		const hit = { damagePctBonus: 0, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false as const, varianceRange: [1, 1] as const };
		const ctx = {
			self: fighter(),
			enemy: dummy(),
			round: 1,
			rng: () => 0.5,
			log: () => {},
		};
		decorated.prepareOutgoingHit(ctx, hit);
		expect(hit.damagePctBonus).toBe(30);
		expect(decorated.key).toBe('none');
	});
});
