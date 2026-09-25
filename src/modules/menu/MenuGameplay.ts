import type { CombatClass } from '../identity/domain/PlayerAccount.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { RaidResult } from '../pve/application/RaidService.js';
import type { MenuButtonStyle, MenuPanelData } from './MenuItem.js';
import type { MenuAction } from './menuIds.js';
import type { InventoryCategory } from '../../shared/ui/render/InventoryPager.js';
import { AppError } from '../../shared/kernel/Result.js';
import { DI_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';

export type GameplayScreen =
	| { kind: 'profile' | 'quests' | 'battle' | 'gateSelect' | 'gateTiers' }
	| { kind: 'confirm'; operation: 'start'; combatClass: CombatClass }
	| { kind: 'confirm'; operation: 'boss' | 'reroll'; day: string }
	| { kind: 'result' }
	| { kind: 'log'; page: number }
	| { kind: 'inventory'; category: InventoryCategory; page: number }
	| { kind: 'deities'; page: number }
	| { kind: 'shop' }
	| { kind: 'casino' };

/** A rendered menu button. Items write these via the registry; the view only renders them. */
export interface GamePanelButton {
	action: MenuAction;
	label: string;
	value?: string;
	disabled?: boolean;
	danger?: boolean;
	style?: MenuButtonStyle;
	emoji?: string;
	group?: string;
	/** When true the view starts a new action row before this button. */
	row?: boolean;
}

export interface GamePanel {
	title: string;
	body: string;
	/** Dynamic values item options read for the current screen. */
	data?: MenuPanelData;
	/** Filled from `items/registry` for every rendered panel. */
	buttons?: GamePanelButton[];
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
	const missing = (): Promise<never> => Promise.reject(new AppError('DI_MENU_NOT_WIRED', DI_ERROR_TEXT.menuNotWired));
	return { render: () => missing(), act: () => missing() };
}
