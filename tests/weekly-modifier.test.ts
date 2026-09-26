import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { cappedHeal, createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { NullClassStrategy } from '../src/modules/combat-shared/domain/classes/NullClassStrategy.js';
import {
	applyWeeklyFlags,
	isWeeklyEligible,
	weeklyModifierAt,
	WEEKLY_MODIFIERS,
} from '../src/shared/config/weeklyModifiers.js';
import { weekWindowAt } from '../src/shared/config/ranked.js';

describe('weekly modifier rotation (Phase 4d)', () => {
	it('is deterministic within a week and cycles through all four modifiers', () => {
		const base = weekWindowAt(new Date('2026-01-05T12:00:00+07:00'));
		expect(weeklyModifierAt(base.startsAt)).toBe(weeklyModifierAt(new Date(base.startsAt.getTime() + 1000)));
		const seen = new Set<string>();
		for (let w = 0; w < 4; w++) {
			seen.add(weeklyModifierAt(new Date(base.startsAt.getTime() + w * 7 * 86_400_000)));
		}
		expect(seen).toEqual(new Set(['none', 'bloodmoon', 'frenzy', 'drought']));
	});

	it('documents every modifier in the UI manifest', () => {
		for (const key of ['none', 'bloodmoon', 'frenzy', 'drought'] as const) {
			expect(WEEKLY_MODIFIERS[key].name.length).toBeGreaterThan(0);
			expect(WEEKLY_MODIFIERS[key].desc.length).toBeGreaterThan(0);
		}
	});

	it('only touches regular/elite hunts — never boss, final, duel or ranked', () => {
		expect(isWeeklyEligible(false, false)).toBe(true);
		expect(isWeeklyEligible(true, false)).toBe(false);
		expect(isWeeklyEligible(false, true)).toBe(false);
		expect(isWeeklyEligible(true, true)).toBe(false);
	});

	it('applies each modifier to both sides flags', () => {
		const flags = () => ({ fieldDamagePct: 0, earlySuddenDeath: false, healMult: 1 });
		const player = flags();
		const enemy = flags();
		applyWeeklyFlags(player, enemy, 'none');
		expect(player).toEqual(flags());
		applyWeeklyFlags(player, enemy, 'frenzy');
		expect(player.fieldDamagePct).toBeCloseTo(0.2);
		expect(enemy.fieldDamagePct).toBeCloseTo(0.2);
		const p2 = flags();
		const e2 = flags();
		applyWeeklyFlags(p2, e2, 'drought');
		expect(p2.healMult).toBe(0.5);
		const p3 = flags();
		const e3 = flags();
		applyWeeklyFlags(p3, e3, 'bloodmoon');
		expect(p3.earlySuddenDeath && e3.earlySuddenDeath).toBe(true);
	});
});

describe('weekly battle effects', () => {
	const wall = () =>
		createCombatant({ name: 'Wall', combatClass: null, hp: 1_000_000_000, atk: 1, def: 0, crit: 0 });

	it('bloodmoon moves sudden death to round 16', () => {
		const player = wall();
		const enemy = wall();
		applyWeeklyFlags(player.flags, enemy.flags, 'bloodmoon');
		const result = new BattleEngine().resolve(player, enemy, 7, {
			playerStrategy: new NullClassStrategy(),
			enemyStrategy: new NullClassStrategy(),
		});
		expect(result.rounds).toBeGreaterThan(15);
		const headerIndex = result.log.findIndex((line) => line.includes('TỬ CHIẾN'));
		expect(headerIndex).toBeGreaterThanOrEqual(0);
		const round16Index = result.log.findIndex((line) => line.includes('Hiệp 16'));
		expect(headerIndex).toBeGreaterThan(round16Index);
	});

	it('frenzy deals more damage than a clean battle', () => {
		const run = (frenzy: boolean) => {
			const attacker = createCombatant({ name: 'A', combatClass: null, hp: 100000, atk: 300, def: 50, crit: 5 });
			const defender = createCombatant({ name: 'D', combatClass: null, hp: 100000, atk: 100, def: 50, crit: 5 });
			if (frenzy) applyWeeklyFlags(attacker.flags, defender.flags, 'frenzy');
			return new BattleEngine().resolve(attacker, defender, 42, {
				playerStrategy: new NullClassStrategy(),
				enemyStrategy: new NullClassStrategy(),
			});
		};
		expect(run(true).enemyHpRemaining).toBeLessThan(run(false).enemyHpRemaining);
	});

	it('drought halves healing through the shared budget', () => {
		const normal = createCombatant({ name: 'N', combatClass: null, hp: 10000, atk: 10, def: 10, crit: 0 });
		normal.hp = 5000;
		const dry = createCombatant({ name: 'D', combatClass: null, hp: 10000, atk: 10, def: 10, crit: 0 });
		dry.hp = 5000;
		applyWeeklyFlags(dry.flags, dry.flags, 'drought');
		expect(cappedHeal(normal, 800)).toBe(800);
		expect(cappedHeal(dry, 800)).toBe(400);
	});
});
