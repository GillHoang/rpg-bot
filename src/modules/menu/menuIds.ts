export const MENU_PREFIX = 'menu:';
export const MENU_OPEN_ID = 'menu:v1:open';
export const GAME_ACTIONS = [
	'portal',
	'gate',
	'battle',
	'inventory',
	'invcat',
	'invprev',
	'invnext',
	'deities',
	'deityprev',
	'deitynext',
	'deity',
	'shop',
	'casino',
	'class',
	'stats',
	'gear',
	'profile',
	'daily',
	'quests',
	'reroll',
	'claim',
	'hunt',
	'fight',
	'continue',
	'boss',
	'confirm',
	'cancel',
	'log',
	'first',
	'last',
	'prev',
	'next',
	'result',
] as const;
export type MenuAction = 'help' | 'home' | 'back' | 'refresh' | 'close' | (typeof GAME_ACTIONS)[number];
const ACTIONS = new Set<string>(['help', 'home', 'back', 'refresh', 'close', ...GAME_ACTIONS]);

/** Actions whose custom ID carries a `value` nonce; every other action must be nonce-less. */
const NONCE_ACTIONS = new Set<string>(['gate', 'fight', 'invcat']);

/** Inventory category nonce vocabulary — keep in sync with INVENTORY_CATEGORIES. */
const INVENTORY_CATEGORY_RE = /^(bag|weapons|armors|runes)$/;

export function menuId(id: string, revision: number, action: MenuAction, nonce?: string): string {
	const suffix = nonce ? `:${nonce}` : '';
	return `menu:v1:${id}:${revision}:${action}${suffix}`;
}

export function parseMenuId(
	value: string,
): { id: string; revision: number; action: MenuAction; nonce?: string } | null {
	if (value.length > 100) return null;
	const match = /^menu:v1:([a-f0-9]{24}):(0|[1-9]\d*):([a-z]+)(?::([a-z0-9]+))?$/.exec(value);
	if (!match || !ACTIONS.has(match[3]!)) return null;
	const revision = Number(match[2]);
	if (!Number.isSafeInteger(revision)) return null;
	const action = match[3] as MenuAction;
	const nonce = match[4];
	// Nonce is present iff the action is parameterized; a forged nonce on a
	// plain action (or a missing nonce on a parameterized one) is rejected.
	if (NONCE_ACTIONS.has(action) !== (nonce !== undefined)) return null;
	if (action === 'gate' && !/^[1-5]$/.test(nonce ?? '')) return null;
	if (action === 'fight' && !/^([1-9]|10)$/.test(nonce ?? '')) return null;
	if (action === 'invcat' && !INVENTORY_CATEGORY_RE.test(nonce ?? '')) return null;
	return { id: match[1]!, revision, action, nonce };
}
