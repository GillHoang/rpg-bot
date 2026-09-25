import type { MenuSession } from './MenuSessionStore.js';
import type { MenuAction } from './menuIds.js';

/** Actions that always reuse the current session/message instead of forking. */
const IN_PLACE_ACTIONS: ReadonlySet<string> = new Set(['search', 'close']);

/**
 * Pure menu session-fork policy, extracted from MenuRouter so the routing
 * class stays about interaction flow. A launcher session (the original
 * `/menu` message) forks a fresh session for the next screen unless the
 * action updates the current panel in place.
 */
export function updatesInPlace(source: MenuSession, action: MenuAction): boolean {
	if (source.gamePanel?.classes) return true;
	if (['daily', 'quests', 'claim', 'reroll'].includes(action)) return true;
	if (
		source.screen.kind === 'confirm' &&
		source.screen.operation === 'reroll' &&
		['confirm', 'cancel'].includes(action)
	)
		return true;
	return source.screen.kind !== 'home' && ['home', 'back', 'refresh'].includes(action);
}

export function shouldForkSession(source: MenuSession, action: MenuAction): boolean {
	return source.launcher === true && !updatesInPlace(source, action) && !IN_PLACE_ACTIONS.has(action);
}
