import { describe, expect, it, vi } from 'vitest';
import { choose, rollChance } from '../src/utils/weightedRandom.js';
import { createRng } from '../src/domain/combat/Rng.js';
import { rollCrit } from '../src/domain/combat/DamageCalculator.js';
import { rollRaidChest } from '../src/config/raidLoot.js';
import { CoinTossGame } from '../src/domain/casino/games/CoinTossGame.js';
import { DiceRollGame } from '../src/domain/casino/games/DiceRollGame.js';

describe('unified outcome selection', () => {
	it('handles impossible/guaranteed outcomes and clamps stat probabilities', () => {
		for (const n of [0, 0.5, 0.999999]) {
			expect(rollChance(0, () => n)).toBe(false);
			expect(rollChance(1, () => n)).toBe(true);
			expect(rollCrit(() => n, -10)).toBe(false);
			expect(rollCrit(() => n, 150)).toBe(true);
		}
		expect(() => rollChance(NaN, () => 0)).toThrow();
		expect(() => choose([], () => 0)).toThrow();
	});
	it('preserves representative probabilities over seeded samples', () => {
		for (const probability of [0.05, 0.2, 0.3, 0.35, 0.4, 0.5]) {
			const rng = createRng(12345);
			let wins = 0;
			for (let i = 0; i < 20000; i++) if (rollChance(probability, rng)) wins++;
			expect(Math.abs(wins / 20000 - probability)).toBeLessThan(0.015);
		}
	});
	it('replays casino, crit and raid outcomes without Math.random', () => {
		const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => {
			throw Error('Unseeded RNG');
		});
		try {
			const run = () => {
				const rng = createRng(42);
				return Array.from({ length: 100 }, () => [
					new CoinTossGame().play(100, rng),
					new DiceRollGame().play(100, rng),
					rollCrit(rng, 25),
					rollRaidChest(rng, 0.2),
					choose(['a', 'b', 'c', 'd'], rng),
				]);
			};
			expect(run()).toEqual(run());
			expect(forbidden).not.toHaveBeenCalled();
		} finally {
			forbidden.mockRestore();
		}
	});
	it('keeps all six dice faces reachable with equal intervals', () => {
		const game = new DiceRollGame();
		for (let face = 1; face <= 6; face++) {
			const outcome = game.play(100, () => (face - 0.5) / 6);
			expect(outcome.metadata?.d1).toBe(face);
			expect(outcome.metadata?.d2).toBe(face);
		}
	});
});
