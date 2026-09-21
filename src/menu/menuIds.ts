export const MENU_PREFIX = 'menu:';
export const MENU_OPEN_ID = 'menu:v1:open';
export const GAME_ACTIONS = [
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
	'boss',
	'confirm',
	'cancel',
	'log',
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
	const match = /^menu:v1:([a-f0-9]{24}):(0|[1-9]\d*):([a-z]+)(?::([a-f0-9]{16}))?$/.exec(value);
	if (!match || !ACTIONS.has(match[3]!)) return null;
	const revision = Number(match[2]);
	if (!Number.isSafeInteger(revision)) return null;
	const action = match[3] as MenuAction;
	if ((action === 'find') !== (match[4] !== undefined)) return null;
	return { id: match[1]!, revision, action, nonce: match[4] };
}
