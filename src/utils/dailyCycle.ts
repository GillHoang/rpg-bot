const TIME_ZONE = 'Asia/Manila';

const formatter = new Intl.DateTimeFormat('en-US', {
	timeZone: TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

/**
 * Ported from utils/dailyCycle.js. The "daily cycle" is a calendar date in
 * Asia/Manila, not a rolling 24h window — a claim always resets at PHT
 * midnight regardless of what time the player claimed the day before.
 */
export class DailyCycle {
	static keyAt(instant: Date = new Date()): string {
		const parts = Object.fromEntries(
			formatter
				.formatToParts(instant)
				.filter((p) => p.type !== 'literal')
				.map((p) => [p.type, p.value]),
		) as Record<'year' | 'month' | 'day', string>;
		return `${parts.year}-${parts.month}-${parts.day}`;
	}

	static yesterdayKeyAt(instant: Date = new Date()): string {
		const oneDayMs = 24 * 60 * 60 * 1000;
		return DailyCycle.keyAt(new Date(instant.getTime() - oneDayMs));
	}
}
