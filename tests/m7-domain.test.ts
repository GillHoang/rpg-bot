import { describe, expect, it } from 'vitest';
import { BattleEngine, SUDDEN_DEATH_START, suddenDeathMultiplier } from '../src/domain/combat/BattleEngine.js';
import { createCombatant } from '../src/domain/combat/CombatantState.js';
import { NullClassStrategy } from '../src/domain/combat/classes/NullClassStrategy.js';
import { wrapWithBlessings } from '../src/domain/combat/DeityBlessingDecorator.js';
import { blessingStrength, resonanceBonus } from '../src/config/blessings.js';
import { eloDelta } from '../src/config/ranked.js';

describe('elo', () => {
	it('is zero-sum: decisive deltas mirror, draws between equals move nothing', () => {
		for (let rating = 800; rating <= 2200; rating += 100) {
			expect(eloDelta(rating, rating, 1)).toBe(16);
			expect(eloDelta(rating, rating, 0)).toBe(-16);
			expect(eloDelta(rating, rating, 0.5)).toBe(0);
		}
		for (let d = -400; d <= 400; d += 50) {
			const high = 1500 + d;
			const low = 1500 - d;
			// Zero-sum: win/loss mirror exactly, draw deltas cancel (sum-based —
			// Object.is would distinguish 0 from -0).
			expect(eloDelta(high, low, 1) + eloDelta(low, high, 0)).toBe(0);
			expect(eloDelta(high, low, 0.5) + eloDelta(low, high, 0.5)).toBe(0);
		}
		// An upset and a favourite's win still move the ladder by at least 1.
		expect(eloDelta(1200, 2400, 1)).toBeGreaterThanOrEqual(1);
		expect(eloDelta(2400, 1200, 0)).toBeLessThanOrEqual(-1);
	});
});

describe('sudden death', () => {
	it('multiplies damage ×2 per round past 30 and logs the header once', () => {
		expect(suddenDeathMultiplier(1)).toBe(1);
		expect(suddenDeathMultiplier(SUDDEN_DEATH_START)).toBe(1);
		expect(suddenDeathMultiplier(SUDDEN_DEATH_START + 1)).toBe(2);
		expect(suddenDeathMultiplier(SUDDEN_DEATH_START + 3)).toBe(8);

		// Two nigh-unkillable walls grind to round 40 — sudden death must fire.
		const wall = () =>
			createCombatant({ name: 'Wall', combatClass: null, hp: 1_000_000_000, atk: 1, def: 0, crit: 0 });
		const result = new BattleEngine().resolve(wall(), wall(), 7, {
			playerStrategy: new NullClassStrategy(),
			enemyStrategy: new NullClassStrategy(),
		});
		expect(result.rounds).toBeGreaterThan(SUDDEN_DEATH_START);
		expect(result.log.filter((line) => line.includes('TỬ CHIẾN'))).toHaveLength(1);
	});
});

describe('deity blessing decorator', () => {
	it('scales strength from sigils with a cap and binary blessings stay 1', () => {
		expect(blessingStrength('scalable', 0)).toBe(0.5);
		expect(blessingStrength('scalable', 10)).toBe(1.0);
		expect(blessingStrength('scalable', 999)).toBe(1.0);
		expect(blessingStrength('binary', 0)).toBe(1);
	});

	it('tailwind biases the initiative roll and guardian light heals each round', () => {
		const player = createCombatant({ name: 'P', combatClass: null, hp: 1_000_000_000, atk: 0, def: 0, crit: 0 });
		const enemy = createCombatant({ name: 'E', combatClass: null, hp: 1_000_000_000, atk: 100, def: 0, crit: 0 });
		enemy.flags.initiative_bias = -1; // Player with Tailwind always outruns −1.
		const strategy = wrapWithBlessings(new NullClassStrategy(), [
			{ key: 'tailwind', strength: 1 },
			{ key: 'guardian_light', strength: 1 },
		]);
		const result = new BattleEngine().resolve(player, enemy, 7, {
			playerStrategy: strategy,
			enemyStrategy: new NullClassStrategy(),
		});
		// Round 1: Tailwind log, then the biased holder acts first.
		expect(result.log[1]).toContain('Tailwind');
		expect(result.log[2]).toContain('P đánh E, gây 0');
		// ~100 damage/round against a 20M-per-round heal cap → a heal log every round.
		expect(result.log.filter((line) => line.includes('Guardian Light')).length).toBeGreaterThanOrEqual(35);
	});

	it('sky sovereign nullifies exactly one hit', () => {
		const squishy = createCombatant({ name: 'P', combatClass: null, hp: 100, atk: 0, def: 0, crit: 0 });
		const bruiser = createCombatant({ name: 'E', combatClass: null, hp: 1_000_000, atk: 999_999, def: 0, crit: 0 });
		const sovereign = wrapWithBlessings(new NullClassStrategy(), [{ key: 'sky_sovereign', strength: 1 }]);
		const result = new BattleEngine().resolve(squishy, bruiser, 7, {
			playerStrategy: sovereign,
			enemyStrategy: new NullClassStrategy(),
		});
		expect(result.log.filter((line) => line.includes('Sky Sovereign'))).toHaveLength(1);
		expect(result.log.filter((line) => line.includes('E đánh P, gây 0'))).toHaveLength(1);
		expect(result.outcome).toBe('enemy_win');
	});
});

describe('pantheon resonance', () => {
	it('grants +10% for a matching pair and +20% for a matching triple', () => {
		expect(resonanceBonus(['Filipino'])).toBe(0);
		expect(resonanceBonus(['Filipino', 'Norse'])).toBe(0);
		expect(resonanceBonus(['Filipino', 'Filipino'])).toBe(0.1);
		expect(resonanceBonus(['Filipino', 'Filipino', 'Norse'])).toBe(0.1);
		expect(resonanceBonus(['Filipino', 'Filipino', 'Filipino'])).toBe(0.2);
	});
});
