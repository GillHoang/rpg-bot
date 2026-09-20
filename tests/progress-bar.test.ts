import { describe, expect, it } from 'vitest';
import { PROGRESS_BAR_EMOJIS, renderProgressBar } from '../src/utils/progressBar.js';

const { blue, green } = PROGRESS_BAR_EMOJIS.full;
const { yellow } = PROGRESS_BAR_EMOJIS.partial;
const { empty } = PROGRESS_BAR_EMOJIS;

describe('renderProgressBar', () => {
	it('renders a full accent bar with left/middle/right caps at 100%', () => {
		expect(renderProgressBar({ current: 100, max: 100, cells: 5 })).toBe(
			[blue.left, blue.mid, blue.mid, blue.mid, blue.right].join(''),
		);
	});

	it('renders the green accent at 100% when color is green', () => {
		expect(renderProgressBar({ current: 2, max: 2, cells: 4, color: 'green' })).toBe(
			[green.left, green.mid, green.mid, green.right].join(''),
		);
	});

	it('renders a full gray track at 0%', () => {
		expect(renderProgressBar({ current: 0, max: 100, cells: 3 })).toBe(
			[empty.left, empty.mid, empty.right].join(''),
		);
	});

	it('renders partial progress as yellow fill over the gray track', () => {
		// Caps belong to the whole track, so the fill boundary meets flush with mids.
		expect(renderProgressBar({ current: 50, max: 100, cells: 10 })).toBe(
			[
				yellow.left,
				yellow.mid,
				yellow.mid,
				yellow.mid,
				yellow.mid,
				empty.mid,
				empty.mid,
				empty.mid,
				empty.mid,
				empty.right,
			].join(''),
		);
	});

	it('never leaks the accent color into a partial bar', () => {
		const bar = renderProgressBar({ current: 95, max: 100, cells: 10 });
		for (const piece of [blue.left, blue.mid, blue.right, green.left, green.mid, green.right]) {
			expect(bar).not.toContain(piece);
		}
		expect(bar.endsWith(empty.right)).toBe(true);
	});

	it('clamps out-of-range values', () => {
		expect(renderProgressBar({ current: -10, max: 100, cells: 3 })).toBe(
			[empty.left, empty.mid, empty.right].join(''),
		);
		// 999 clamps to max → a genuinely full bar earns the accent color.
		expect(renderProgressBar({ current: 999, max: 100, cells: 3 })).toBe(
			[blue.left, blue.mid, blue.right].join(''),
		);
	});

	it('shows at least one yellow cell for tiny progress', () => {
		const bar = renderProgressBar({ current: 0.5, max: 100, cells: 10 });
		expect(bar.startsWith(yellow.left)).toBe(true);
		expect(bar.endsWith(empty.right)).toBe(true);
	});

	it('renders an empty bar for max = 0', () => {
		expect(renderProgressBar({ current: 0, max: 0, cells: 3 })).toBe(
			[empty.left, empty.mid, empty.right].join(''),
		);
	});

	it('trims the empty track when trimEmpty is set', () => {
		const bar = renderProgressBar({ current: 50, max: 100, cells: 4, trimEmpty: true });
		expect(bar).toBe([yellow.left, yellow.right].join(''));
	});

	it('keeps a visible cell when trimming an empty bar', () => {
		expect(renderProgressBar({ current: 0, max: 100, cells: 4, trimEmpty: true })).toBe(empty.left);
	});

	it('rejects invalid cells and non-finite values', () => {
		expect(() => renderProgressBar({ current: 1, max: 2, cells: 0 })).toThrow(RangeError);
		expect(() => renderProgressBar({ current: 1, max: 2, cells: 2.5 })).toThrow(RangeError);
		expect(() => renderProgressBar({ current: Number.NaN, max: 2 })).toThrow(RangeError);
		expect(() => renderProgressBar({ current: 1, max: Number.POSITIVE_INFINITY })).toThrow(RangeError);
	});

	it('pins the yellow set to its reversed numbering (linee1 = right cap)', () => {
		expect(yellow.right).toBe('<a:linee1:1550838101839056996>');
		const bar = renderProgressBar({ current: 3, max: 4, cells: 5 });
		expect(bar.startsWith(yellow.left)).toBe(true);
		expect(bar).toContain(yellow.mid);
		expect(bar.endsWith(empty.right)).toBe(true);
	});
});
