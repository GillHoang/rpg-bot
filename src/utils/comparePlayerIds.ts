/** Shared lexical order for multiplayer locks, independent of the host's default locale. */
export function comparePlayerIds(left: string, right: string): number {
	return left.localeCompare(right, 'en');
}
