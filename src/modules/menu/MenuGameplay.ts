import type { CombatClass } from '../identity/domain/PlayerAccount.js';
import type { MenuAction } from './menuIds.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { RaidResult } from '../pve/application/RaidService.js';
import { AppError } from '../../shared/kernel/Result.js';
import { DI_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';

export type GameplayScreen =
	| { kind: 'profile' | 'quests' | 'battle' | 'gateSelect' | 'gateTiers' }
	| { kind: 'confirm'; operation: 'start'; combatClass: CombatClass }
	| { kind: 'confirm'; operation: 'boss' | 'reroll'; day: string }
	| { kind: 'result' }
	| { kind: 'log'; page: number };
export interface GamePanel {
	title: string;
	body: string;
	buttons: {
		action: MenuAction;
		label: string;
		value?: string;
		disabled?: boolean;
		danger?: boolean;
		group?: string;
	}[];
	selectors?: {
		action: 'portal' | 'gate';
		placeholder: string;
		options: { label: string; value: string; default?: boolean }[];
	}[];
	classes?: boolean;
	withAvatar?: boolean;
	grouped?: boolean;
}
export type MenuBattle = Extract<RaidResult, { status: 'ok' }> & {
	boss: boolean;
	portal?: { gate: number; tier: number };
};
export interface MenuGameplay {
	render(session: MenuSession): Promise<GamePanel | undefined>;
	act(session: MenuSession, action: MenuAction, username: string, value?: string): Promise<MenuScreen>;
}

/** Menu gameplay must come from `createAppContainer().menuGameplay` — there is
 * no global fallback (persistence is required, see kernel/persistence). */
export function lazyGameplay(): MenuGameplay {
	const missing = (): Promise<never> =>
		Promise.reject(new AppError('DI_MENU_NOT_WIRED', DI_ERROR_TEXT.menuNotWired));
	return { render: () => missing(), act: () => missing() };
}
