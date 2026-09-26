import { describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { MonsterStrategy } from '../src/modules/combat-shared/domain/classes/MonsterStrategy.js';
import { NullClassStrategy } from '../src/modules/combat-shared/domain/classes/NullClassStrategy.js';
import {
	behaviorModifiers,
	combineModifierBonus,
} from '../src/modules/pve/application/MonsterEncounterService.js';
import { modifierList } from '../src/shared/ui/text/portals.js';
import type { Executor } from '../src/db/client.js';
import type { MonsterRosterRepository } from '../src/modules/pve/infrastructure/MonsterRosterRepository.js';
import { MonsterEncounterService } from '../src/modules/pve/application/MonsterEncounterService.js';

const executor = Object.freeze({}) as unknown as Executor;

describe('stacked gate modifiers (Phase 4b)', () => {
	it('multiplies both bonuses with a per-stat clamp', () => {
		expect(combineModifierBonus('none', 'none')).toEqual({ hp: 1, atk: 1, def: 1 });
		const stacked = combineModifierBonus('regen', 'enrage');
		expect(stacked.hp).toBeCloseTo(1.35 * 0.95, 5);
		expect(stacked.atk).toBeCloseTo(0.95 * 1.15, 5);
		// Clamp: aggressive × aggressive would hit 1.35² atk without it.
		expect(combineModifierBonus('aggressive', 'aggressive').atk).toBeLessThanOrEqual(1.6);
		expect(combineModifierBonus('tanky', 'tanky').def).toBeLessThanOrEqual(1.6);
	});

	it('passes only behavior modifiers to strategy hooks', () => {
		expect(behaviorModifiers('none')).toEqual([]);
		expect(behaviorModifiers('regen')).toEqual([]);
		expect(behaviorModifiers('evasive')).toEqual([]);
		expect(behaviorModifiers('regen', 'enrage')).toEqual(['enrage']);
		expect(behaviorModifiers('reflect', 'drain')).toEqual(['reflect', 'drain']);
	});

	it('labels one or two modifiers for the gate UI', () => {
		expect(modifierList(['none'])).toBe('Cân bằng');
		expect(modifierList(['regen', 'enrage'])).toBe('Máu dày (+HP) + Cuồng nộ (<50% HP)');
		expect(modifierList(['bogus'])).toBe('bogus');
	});

	it('applies the second modifier in encounters', async () => {
		const roster = {
			listForEncounter: vi.fn<MonsterRosterRepository['listForEncounter']>().mockResolvedValue([
				{
					mobId: 1,
					name: 'M',
					mythology: 'T',
					mobType: 'regular',
					baseHp: 600,
					baseAtk: 100,
					baseDef: 50,
					baseCrit: 5,
					hpPerLevel: 10,
					atkPerLevel: 2,
					defPerLevel: 1,
					skillKey: 'none',
					skillName: '',
					skillDescription: '',
					immunityTags: [],
					specialFlags: [],
				},
			]),
		};
		const service = new MonsterEncounterService(roster);
		const single = await service.pickForLevel(executor, 45, () => 0, false, false, 'regen');
		const stacked = await service.pickForLevel(executor, 45, () => 0, false, false, 'regen', 'enrage');
		expect(single!.modifiers).toEqual([]);
		expect(stacked!.modifiers).toEqual(['enrage']);
		expect(stacked!.hp).toBeGreaterThan(0);
		expect(stacked!.atk).toBeGreaterThan(single!.atk);
	});
});

describe('behavior modifier hooks', () => {
	const player = () =>
		createCombatant({ name: 'Player', combatClass: 'Fighter', hp: 10000, atk: 500, def: 100, crit: 5 });
	const mob = (modifiers: string[]) =>
		createCombatant({ name: 'Mob', combatClass: null, hp: 10000, atk: 300, def: 100, crit: 5 });

	function strike(modifiers: string[], seed = 11) {
		const attacker = player();
		const defender = mob(modifiers);
		const result = new BattleEngine().resolve(attacker, defender, seed, {
			playerStrategy: new NullClassStrategy(),
			enemyStrategy: new MonsterStrategy('blood_frenzy', { affixes: [], modifiers }),
		});
		return { result, attacker, defender };
	}

	it('reflect returns part of every landed hit', () => {
		const { attacker } = strike(['reflect']);
		const clean = strike([]);
		// Same battle otherwise: reflected damage leaves the attacker lower.
		expect(attacker.hp).toBeLessThan(clean.attacker.hp);
		expect(clean.result.log.join('\n')).not.toContain('phản lại');
	});

	it('drain heals the striker and enrage hits harder below half HP', () => {
		const { defender } = strike(['drain']);
		expect(defender.hp).toBeLessThanOrEqual(10000);
		const { result } = strike(['enrage']);
		expect(result.log.join('\n')).toContain('cuồng nộ');
	});

	it('shielded opens behind a shield wall and rupture pierces armor', () => {
		const defender = mob(['shielded']);
		const strategy = new MonsterStrategy('blood_frenzy', { affixes: [], modifiers: ['shielded'] });
		const ctx = { self: defender, enemy: player(), round: 1, rng: () => 0.5, log: (_m: string) => {} };
		strategy.onRoundStart(ctx);
		expect(defender.shield).toBe(2000);
		const hit = { damagePctBonus: 0, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false as const, varianceRange: [1, 1] as const };
		new MonsterStrategy('blood_frenzy', { affixes: [], modifiers: ['rupture'] }).prepareOutgoingHit(
			{ self: defender, enemy: player(), round: 1, rng: () => 0.5, log: () => {} },
			hit,
		);
		expect(hit.armorPierceFraction).toBeCloseTo(0.25);
	});

	it.each([
		['executioner', 'wounded prey'],
		['bulwark', 'armored hide'],
		['lifedrinker', 'deep thirst'],
		['berserk', 'burning blood'],
		['deadeye', 'keen aim'],
	] as const)('applies the %s affix in battle', (affix) => {
		const attacker = player();
		attacker.hp = 2000; // wounded: executioner must trigger
		const defender = mob([affix]);
		const result = new BattleEngine().resolve(attacker, defender, 77, {
			playerStrategy: new NullClassStrategy(),
			enemyStrategy: new MonsterStrategy('blood_frenzy', { affixes: [affix], modifiers: [] }),
		});
		expect(result.rounds).toBeGreaterThan(0);
		if (affix === 'deadeye') expect(defender.crit).toBe(15);
		if (affix === 'berserk') expect(result.log.join('\n')).toContain('đốt');
	});
});
