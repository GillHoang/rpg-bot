// wrand 1.2.0's package entry points at a missing index.js. Import its published
// self-contained implementation; never patch node_modules or fall back to Math.random.
import { RandomPicker } from 'wrand/lib/randomPicker.js';
export { RandomPicker };
export function pick<T>(items: Array<{ original: T; weight: number }>, options: { next: () => number }): T {
	return new RandomPicker(items, options).pick();
}

/** Probability is a fraction, not a percentage. */
export function rollChance(probability: number, rng: () => number): boolean {
	if (!Number.isFinite(probability)) throw new RangeError('Probability must be finite');
	const weight = Math.max(0, Math.min(1, probability));
	return pick(
		[
			{ original: true, weight },
			{ original: false, weight: 1 - weight },
		].filter((item) => item.weight > 0),
		{ next: rng },
	);
}
export function choose<T>(items: readonly T[], rng: () => number): T {
	if (!items.length) throw new Error('Thiếu dữ liệu seed cho phần thưởng. Tài nguyên chưa bị trừ.');
	return pick(
		items.map((original) => ({ original, weight: 1 })),
		{ next: rng },
	);
}
