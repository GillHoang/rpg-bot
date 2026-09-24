import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import { AppError } from '../../shared/kernel/Result.js';
import type { MenuAction } from './menuIds.js';
import { MENU_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';

/**
 * SRP extraction from MenuGameplayService: navigation actions that never
 * touch persistence. Unlike render(), act() IS allowed to mutate the
 * session — selection actions (hunt/gate/portal) normalize gateId/portalGate
 * in place and return the next screen. Pure pager math lives below.
 */
export function routeStatelessAction(
	session: MenuSession,
	action: MenuAction,
	value?: string,
): MenuScreen | null {
	switch (action) {
		case 'inventory':
		case 'deity':
		case 'shop':
		case 'casino':
			return { kind: 'section', section: action };
		case 'battle':
		case 'hunt':
			session.gateId = undefined;
			session.portalGate = undefined;
			return { kind: 'gateSelect' };
		case 'gate':
			session.gateId = Number(value);
			session.portalGate = undefined;
			return { kind: 'gateTiers' };
		case 'portal':
			session.portalGate = Number(value);
			return { kind: 'gateTiers' };
		case 'profile':
			return { kind: 'profile' };
		case 'quests':
			return { kind: 'quests' };
		case 'result':
			return { kind: 'result' };
		case 'log':
			return { kind: 'log', page: Math.max(0, (session.battle?.battle.roundLogs.length ?? 1) - 1) };
		default:
			return null;
	}
}

/** Pager math for the battle log — pure, unit-testable. */
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
