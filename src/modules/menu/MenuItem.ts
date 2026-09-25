import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { GamePanel } from './MenuGameplay.js';

/**
 * Menu item contract. Every menu element lives in its own file under
 * `menu/items/{category}/{name}.ts` and default-exports a `MenuItemSpec`.
 * The category is derived from the folder path (freestyle) and the name from
 * the file basename — neither is written in the file itself. A build-time
 * script scans the folder and emits `items/registry.generated.ts`.
 *
 * The registered `MenuItem` (spec + name + category) is what the router and
 * the view consume; item files never import the registry (no cycles).
 */

export type MenuButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

/** One renderable button produced by an item (most items produce exactly one). */
export interface MenuButtonOption {
	label: string;
	/** Present only for parameterized items (gate/fight); drives the customId nonce. */
	value?: string;
	disabled?: boolean;
	style?: MenuButtonStyle;
	emoji?: string;
}

/** Dynamic values a panel computes for the current screen, read by item options. */
export interface MenuPanelData {
	dailyDone?: boolean;
	bossDisabled?: boolean;
	hasBattle?: boolean;
	claimDisabled?: boolean;
	rerollDisabled?: boolean;
	boss?: boolean;
	page?: number;
	pages?: number;
	continuation?: { label: string } | null;
	gates?: { id: number; disabled: boolean }[];
	tiers?: { number: number; disabled: boolean }[];
}

/** Business operations items may invoke; implemented by MenuGameplayService. */
export interface MenuItemApi {
	claimDaily(session: MenuSession): Promise<MenuScreen>;
	claimGrand(session: MenuSession): Promise<MenuScreen>;
	beginConfirmation(session: MenuSession, operation: 'boss' | 'reroll'): MenuScreen;
	cancel(session: MenuSession): MenuScreen;
	confirm(session: MenuSession, username: string): Promise<MenuScreen>;
	fightTier(session: MenuSession, value?: string): Promise<MenuScreen>;
	continueBattle(session: MenuSession): Promise<MenuScreen>;
	navigateLog(session: MenuSession, action: 'first' | 'last' | 'prev' | 'next'): MenuScreen;
}

export interface MenuRunContext {
	session: MenuSession;
	value?: string;
	username: string;
	api: MenuItemApi;
}

export interface MenuItemSpec {
	kind: 'button';
	/** Display group header; defaults to the folder-derived category. */
	group?: string;
	/** Sort order within its group (ascending). */
	order?: number;
	/** Structural visibility; `panel` is the panel being rendered (or the last one on act). */
	visibleWhen: (session: MenuSession, panel: GamePanel | undefined) => boolean;
	/** One or more buttons for this item on the current screen. */
	options: (session: MenuSession, panel: GamePanel | undefined) => MenuButtonOption[];
	run: (ctx: MenuRunContext) => Promise<MenuScreen> | MenuScreen;
}

export interface MenuItem extends MenuItemSpec {
	name: string;
	category: string;
}

/** Screens an item may appear on, as a reusable predicate factory. */
export function onScreens(...kinds: MenuSession['screen']['kind'][]): (session: MenuSession) => boolean {
	return (session) => kinds.includes(session.screen.kind);
}
