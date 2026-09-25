import { describe, expect, it, vi } from 'vitest';
import { choose, rollChance } from '../src/shared/utils/weightedRandom.js';
import { createRng } from '../src/modules/combat-shared/domain/Rng.js';
import { rollCrit } from '../src/modules/combat-shared/domain/DamageCalculator.js';
import { rollRaidChest } from '../src/shared/config/raidLoot.js';
import { CoinTossGame } from '../src/modules/casino/domain/games/CoinTossGame.js';
import { DiceRollGame } from '../src/modules/casino/domain/games/DiceRollGame.js';

describe('unified outcome selection', () => {
	it('handles impossible/guaranteed outcomes and clamps stat probabilities', () => {
		for (const n of [0, 0.5, 0.999999]) {
			expect(rollChance(0, () => n)).toBe(false);
			expect(rollChance(1, () => n)).toBe(true);
			expect(rollCrit(() => n, -10)).toBe(false);
		}
		// Crit caps at 60%: uncapped inputs still roll at the cap, and a high
		// roll stays a miss no matter how far past the cap the stat goes.
		expect(rollCrit(() => 0.5, 60)).toBe(true);
		expect(rollCrit(() => 0.5, 150)).toBe(true);
		expect(rollCrit(() => 0.99, 100)).toBe(false);
		expect(rollCrit(() => 0.99, 1000)).toBe(false);
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
