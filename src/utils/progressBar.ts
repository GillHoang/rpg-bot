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

const emoji = (animated: boolean, name: string, id: string): string =>
	`<${animated ? 'a' : ''}:${name}:${id}>`;

export const PROGRESS_BAR_EMOJIS = {
	/** Palettes for a 100% full bar — the caller picks one. */
	full: {
		blue: {
			left: emoji(true, 'line1', '1550837949271117824'),
			mid: emoji(true, 'line2', '1550837973946212422'),
			right: emoji(true, 'line3', '1550837998118117456'),
		},
		green: {
			left: emoji(true, 'linea1', '1550838020071235704'),
			mid: emoji(true, 'linea2', '1550838051574521977'),
			right: emoji(true, 'linea3', '1550838078610997358'),
		},
	},
	/** Fill color for a bar in progress (0% < value < max). */
	partial: {
		yellow: {
			// TODO: paste the real IDs for linee2/linee3 — they were not in the
			// original emoji list, only linee1's ID is known.
			left: emoji(true, 'linee2', '1550838146789408799'),
			mid: emoji(true, 'linee3', '1550838170206339122'),
			right: emoji(true, 'linee1', '1550838101839056996'),
		},
	},
	/** Gray track for the unfilled remainder and for 0% bars. */
	empty: {
		left: emoji(false, 'line4', '1550837845638389821'),
		mid: emoji(false, 'line6', '1550837891045785620'),
		right: emoji(false, 'line7', '1550837914701926430'),
	},
} as const;

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
	if (!Number.isFinite(current) || !Number.isFinite(max)) {
		throw new RangeError('current and max must be finite numbers');
	}
	if (!Number.isInteger(cells) || cells < MIN_CELLS || cells > MAX_CELLS) {
		throw new RangeError(`cells must be an integer in [${MIN_CELLS}, ${MAX_CELLS}]`);
	}

	const clamped = Math.max(0, Math.min(max, current));
	const fraction = max > 0 ? clamped / max : 0;
	let filled = Math.round(fraction * cells);
	// Keep the bar honest at the extremes: any progress shows at least one cell,
	// and a non-maxed value never fills the whole bar.
	if (clamped > 0 && filled === 0) filled = 1;
	if (clamped < max && filled === cells) filled = cells - 1;

	// The accent color marks a genuinely full bar; in-progress fills are yellow.
	const filledSet =
		filled === cells ? PROGRESS_BAR_EMOJIS.full[color] : PROGRESS_BAR_EMOJIS.partial.yellow;
	const shown = trimEmpty ? Math.max(filled, 1) : cells;
	const pieces: string[] = [];
	for (let i = 0; i < shown; i++) {
		const set = i < filled ? filledSet : PROGRESS_BAR_EMOJIS.empty;
		pieces.push(i === 0 ? set.left : i === shown - 1 ? set.right : set.mid);
	}
	return pieces.join('');
}
