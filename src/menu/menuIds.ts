export const MENU_PREFIX = 'menu:';
export const MENU_OPEN_ID = 'menu:v1:open';
export const GAME_ACTIONS = [
	'portal',
	'gate',
	'battle',
	'inventory',
	'deity',
	'shop',
	'casino',
	'class',
	'profile',
	'daily',
	'quests',
	'reroll',
	'claim',
	'hunt',
	'fight',
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
export type MenuAction =
	| 'section'
	| 'help'
	| 'topic'
	| 'search'
	| 'find'
	| 'home'
	| 'back'
	| 'refresh'
	| 'close'
	| (typeof GAME_ACTIONS)[number];
const ACTIONS = new Set<string>([
	'section',
	'help',
	'topic',
	'search',
	'find',
	'home',
	'back',
	'refresh',
	'close',
	...GAME_ACTIONS,
]);

export function menuId(id: string, revision: number, action: MenuAction, nonce?: string): string {
	const suffix = nonce ? `:${nonce}` : '';
	return `menu:v1:${id}:${revision}:${action}${suffix}`;
}

export function parseMenuId(
	value: string,
): { id: string; revision: number; action: MenuAction; nonce?: string } | null {
	if (value.length > 100) return null;
	const match = /^menu:v1:([a-f0-9]{24}):(0|[1-9]\d*):([a-z]+)(?::([a-f0-9]{16}|[1-9]|10))?$/.exec(value);
	if (!match || !ACTIONS.has(match[3]!)) return null;
	const revision = Number(match[2]);
	if (!Number.isSafeInteger(revision)) return null;
	const action = match[3] as MenuAction;
	const nonceAllowed = action === 'find' || action === 'gate' || action === 'fight';
	if (nonceAllowed !== (match[4] !== undefined)) return null;
	if (action === 'find' && !/^[a-f0-9]{16}$/.test(match[4] ?? '')) return null;
	if (action === 'gate' && !/^[1-5]$/.test(match[4] ?? '')) return null;
	if (action === 'fight' && !/^([1-9]|10)$/.test(match[4] ?? '')) return null;
	return { id: match[1]!, revision, action, nonce: match[4] };
}
