import { PROGRESS_BAR_EMOJIS } from '../text/icons.js';
import { PROGRESS_BAR_ERROR_TEXT } from '../text/diagnostics.js';
// Progress bar built from the server's custom "line" emoji set.
//
// Rendering rules:
// - 0%:         full gray empty track
// - 100%:       whole bar in the accent color (blue or green, caller's choice)
// - in between: filled cells render yellow over the gray track
//
// Emoji roles:
// - full blue:     line1 = left cap, line2 = middle, line3 = right cap
// - full green:    linea1 = left cap, linea2 = middle, linea3 = right cap
// - partial yellow: linee2 = left cap, linee3 = middle, linee1 = right cap (reversed numbering)
// - empty gray:    line4 = left cap, line6 = middle, line7 = right cap

export interface BarPieces {
	left: string;
	mid: string;
	right: string;
}

export { PROGRESS_BAR_EMOJIS } from '../text/icons.js';

export type ProgressBarColor = keyof typeof PROGRESS_BAR_EMOJIS.full;

export interface ProgressBarOptions {
	/** Current value; clamped into [0, max]. */
	current: number;
	/** Maximum value; must be finite. A max of 0 renders an empty bar. */
	max: number;
	/** Total number of emoji cells. Defaults to 10. */
	cells?: number;
	/** Accent color shown when the bar is 100% full. Defaults to 'blue'. */
	color?: ProgressBarColor;
	/** When true, hide the gray empty track so the bar shrinks as it empties. */
	trimEmpty?: boolean;
}

const MIN_CELLS = 1;
const MAX_CELLS = 20;

export function renderProgressBar(options: ProgressBarOptions): string {
	const { current, max, cells = 10, color = 'blue', trimEmpty = false } = options;
	validate(current, max, cells);

	const clamped = Math.max(0, Math.min(max, current));
	const fraction = max > 0 ? clamped / max : 0;
	let filled = Math.round(fraction * cells);
	// Keep the bar honest at the extremes: any progress shows at least one cell,
	// and a non-maxed value never fills the whole bar.
	if (clamped > 0 && filled === 0) filled = 1;
	if (clamped < max && filled === cells) filled = cells - 1;

	// The accent color marks a genuinely full bar; in-progress fills are yellow.
	const filledSet = filled === cells ? PROGRESS_BAR_EMOJIS.full[color] : PROGRESS_BAR_EMOJIS.partial.yellow;
	const shown = trimEmpty ? Math.max(filled, 1) : cells;
	return renderCells(filledSet, filled, shown);
}

function validate(current: number, max: number, cells: number): void {
	if (!Number.isFinite(current) || !Number.isFinite(max)) {
		throw new RangeError(PROGRESS_BAR_ERROR_TEXT.nonFinite);
	}
	if (!Number.isInteger(cells) || cells < MIN_CELLS || cells > MAX_CELLS) {
		throw new RangeError(PROGRESS_BAR_ERROR_TEXT.invalidCells(MIN_CELLS, MAX_CELLS));
	}
}

/** Cap + middle cells + cap: heads at cell 0, tails at the last shown cell. */
function renderCells(filledSet: BarPieces, filled: number, shown: number): string {
	const pieces: string[] = [];
	for (let i = 0; i < shown; i++) {
		pieces.push(cellPiece(i, filled, shown, filledSet));
	}
	return pieces.join('');
}

function cellPiece(index: number, filled: number, shown: number, filledSet: BarPieces): string {
	const set = index < filled ? filledSet : PROGRESS_BAR_EMOJIS.empty;
	if (index === 0) return set.left;
	if (index === shown - 1) return set.right;
	return set.mid;
}
