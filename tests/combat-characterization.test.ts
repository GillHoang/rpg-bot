import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/domain/combat/BattleEngine.js';
import { createCombatant } from '../src/domain/combat/CombatantState.js';
import { ClassStrategyRegistry } from '../src/domain/combat/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../src/domain/combat/RuneStrategyDecorator.js';
import { wrapWithBlessings } from '../src/domain/combat/DeityBlessingDecorator.js';
import { MonsterStrategy } from '../src/domain/combat/classes/MonsterStrategy.js';
import type { CombatClass } from '../src/domain/entities/PlayerAccount.js';

const classes: Array<CombatClass | null> = ['Swordsman', 'Fighter', 'Mage', 'Knight', 'Archer', null];
const seeds = [1, 7, 42, 12345];

// Baseline includes the reviewed round-count, Tailwind, and combat logic corrections.
// Hash the complete logs, round snapshots and mutated combatants so even a
// changed RNG call, hook order or remaining debuff is caught, without storing
// thousands of repetitive log lines. Pin numeric formatting across host locales.
function traceHash(traces: unknown[]): string {
	return createHash('sha256').update(JSON.stringify(traces)).digest('hex');
}

function recordTrace(run: () => unknown[]): string {
	const format = vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (this: number) {
		return new Intl.NumberFormat('en-US').format(Number(this));
	});
	try {
		return traceHash(run());
	} finally {
		format.mockRestore();
	}
}

describe('combat behavior before responsibility extraction', () => {
	it.each(classes)('preserves every seeded class matchup for %s', (combatClass) => {
		const hash = recordTrace(() =>
			classes.flatMap((enemyClass) =>
				seeds.map((seed) => {
					const player = createCombatant({
						name: 'Player',
						combatClass,
						hp: 5000,
						atk: 420,
						def: 160,
						crit: 25,
					});
					const enemy = createCombatant({
						name: 'Enemy',
						combatClass: enemyClass,
						hp: 5500,
						atk: 390,
						def: 180,
						crit: 20,
					});
					const result = new BattleEngine().resolve(player, enemy, seed);
					expect(result.rounds).toBe(result.roundLogs.length);
					return { result, player, enemy };
				}),
			),
		);
		expect(hash).toMatchSnapshot();
	});

	it('preserves rune/blessing chains, monster hooks, immunities and status durations', () => {
		const hash = recordTrace(() =>
			classes.flatMap((combatClass) =>
				['moon_threshold', 'blood_frenzy', 'stone_hide', 'flesh_feast', 'venom_spit'].flatMap((skill) =>
					seeds.map((seed) => {
						const player = createCombatant({
							name: 'Player',
							combatClass,
							hp: 6000,
							atk: 430,
							def: 160,
							crit: 30,
						});
						const enemy = createCombatant({
							name: 'Monster',
							combatClass: null,
							hp: 8500,
							atk: 500,
							def: 220,
							crit: 15,
						});
						player.debuffs.push(
							{ tag: 'stun', turnsLeft: 1, value: 0 },
							{ tag: 'dizzy', turnsLeft: 2, value: 0.5 },
						);
						enemy.debuffs.push(
							{ tag: 'burn', turnsLeft: 2, value: 60 },
							{ tag: 'def_down', turnsLeft: 2, value: 0.2 },
						);
						enemy.immunityTags = seed === 7 ? ['poison', 'blight'] : [];
						const strategy = wrapWithBlessings(
							wrapWithRunes(ClassStrategyRegistry.forClass(combatClass), [
								{ effectKey: 'venom', value: 0.01 },
								{ effectKey: 'blight', value: 0.1 },
								{ effectKey: 'vampiric', value: 0.1 },
								{ effectKey: 'aegis_rune', value: 1 },
								{ effectKey: 'warding', value: 0.2 },
							]),
							[
								{ key: 'tailwind', strength: 0.5 },
								{ key: 'moon_devourer', strength: 1 },
								{ key: 'guardian_light', strength: 0.5 },
							],
						);
						const result = new BattleEngine().resolve(player, enemy, seed, {
							playerStrategy: strategy,
							enemyStrategy: wrapWithRunes(new MonsterStrategy(skill), [
								{ effectKey: 'thorns', value: 0.15 },
							]),
						});
						expect(result.rounds).toBe(result.roundLogs.length);
						return { result, player, enemy };
					}),
				),
			),
		);
		expect(hash).toMatchSnapshot();
	});

	it('preserves sudden death, round-limit ties and pre-defeated combatants', () => {
		const hash = recordTrace(() =>
			[0, 1, 1_000_000_000].flatMap((hp) =>
				seeds.map((seed) => {
					const player = createCombatant({ name: 'Wall', combatClass: null, hp, atk: 1, def: 0, crit: 0 });
					const enemy = createCombatant({ name: 'Wall', combatClass: null, hp, atk: 1, def: 0, crit: 0 });
					const result = new BattleEngine().resolve(player, enemy, seed);
					expect(result.rounds).toBe(result.roundLogs.length);
					return { result, player, enemy };
				}),
			),
		);
		expect(hash).toMatchSnapshot();
	});
});
