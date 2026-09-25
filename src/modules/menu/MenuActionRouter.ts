import type { MenuSession } from './MenuSessionStore.js';
import { AppError } from '../../shared/kernel/Result.js';
import { MENU_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';

/**
 * Pure pager math for the battle log; item files (`combat/first|prev|next|last`)
 * own the action wiring and call these through MenuItemApi.navigateLog.
 */
export function navigateBattleLogPage(
	totalRounds: number,
	currentPage: number,
	action: 'first' | 'last' | 'prev' | 'next',
): number {
	const lastPage = Math.max(0, totalRounds - 1);
	let page = currentPage;
	if (action === 'first') page = 0;
	else if (action === 'last') page = lastPage;
	else if (action === 'next') page += 1;
	else page -= 1;
	return Math.max(0, Math.min(lastPage, page));
}

export function assertBattleLogNavigable(session: MenuSession): void {
	if ((session.screen.kind !== 'log' && session.screen.kind !== 'result') || !session.battle)
		throw new AppError('MENU_MISSING_BATTLE_LOG', MENU_ERROR_TEXT.missingBattleLog);
}
