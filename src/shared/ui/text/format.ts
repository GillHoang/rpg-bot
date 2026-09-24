/** Explicit default preserves the bot's existing comma-separated number display on every host. */
export const TEXT_LOCALE = 'en-US';

/** Presentation only: never use formatted values for database keys or calculations. */
export function formatNumber(value: number, locale = TEXT_LOCALE, options?: Intl.NumberFormatOptions): string {
	return value.toLocaleString(locale, options);
}
