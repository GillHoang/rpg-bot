/**
 * Ranked PvP balance — M7 design defaults (số liệu mới, không port từ bản gốc).
 * Fight = async mirror match: loadout hiện tại của một người chơi ngẫu nhiên
 * khác được dùng làm đối thủ, không cần cả hai online (khớp cấu trúc bảng
 * active_ranked_fights — 1 lock mỗi người, không có cột đối thủ).
 */
import { DailyCycle } from '../utils/dailyCycle.js';

export const RANKED = {
	/** Elo K-factor. */
	K: 32,
	/** Matchmaking rating window; widened stepwise when the pool is thin. */
	WINDOW: 300,
	/** Lock TTL per fight — the sweep clears stale locks. */
	LOCK_SECONDS: 90,
} as const;

export interface Bracket {
	name: 'Mortal' | 'Champion' | 'Demigod' | 'Ascendant' | 'Divine';
	min: number;
}

export const BRACKETS: readonly Bracket[] = [
	{ name: 'Mortal', min: 0 },
	{ name: 'Champion', min: 1100 },
	{ name: 'Demigod', min: 1400 },
	{ name: 'Ascendant', min: 1700 },
	{ name: 'Divine', min: 2000 },
];

export function bracketFor(rating: number): Bracket {
	let current = BRACKETS[0];
	for (const bracket of BRACKETS) if (rating >= bracket.min) current = bracket;
	return current;
}

export function bracketBelow(bracket: Bracket): Bracket | null {
	const index = BRACKETS.findIndex((b) => b.name === bracket.name);
	return index > 0 ? BRACKETS[index - 1] : null;
}

/**
 * Signed Elo delta (M7 design default). Zero-sum by construction: the
 * opponent's delta for the mirrored score is the exact negation — decisive
 * results are clamped to |Δ| ≥ 1 so the ladder always moves, a draw between
 * equals is 0 and must never destroy or create rating.
 */
export function eloDelta(rating: number, opponentRating: number, score: 0 | 0.5 | 1): number {
	const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
	const raw = Math.round(RANKED.K * (score - expected));
	if (score === 1) return Math.max(1, raw);
	if (score === 0) return Math.min(-1, raw);
	return raw;
}

export interface WeekWindow {
	key: string;
	week: number;
	/** Monday 00:00 Asia/Manila as a UTC instant. */
	startsAt: Date;
	endsAt: Date;
}

/**
 * ISO week window anchored to the Asia/Manila calendar (UTC+8 fixed — the
 * same convention as DailyCycle). `key` includes the ISO week-year for persisted claim keys.
 */
export function weekWindowAt(instant: Date = new Date()): WeekWindow {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Manila',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		})
			.formatToParts(instant)
			.filter((p) => p.type !== 'literal')
			.map((p) => [p.type, p.value]),
	) as Record<'year' | 'month' | 'day', string>;
	const civil = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
	const dow = (new Date(civil).getUTCDay() || 7) as number;
	const monday = civil - (dow - 1) * 86_400_000;
	const thursday = monday + (4 - 1) * 86_400_000;
	const thursdayDate = new Date(thursday);
	const week = Math.ceil(((thursday - Date.UTC(thursdayDate.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
	const MANILA_OFFSET_MS = 8 * 3_600_000;
	return {
		week,
		key: `${thursdayDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
		startsAt: new Date(monday - MANILA_OFFSET_MS),
		endsAt: new Date(monday + 7 * 86_400_000 - MANILA_OFFSET_MS),
	};
}

/** Today's Manila date key — re-exported alias so callers have one import. */
export const todayKey = (): string => DailyCycle.keyAt();
