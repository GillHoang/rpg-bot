import type { CombatClass } from '../identity/domain/PlayerAccount.js';
import type { MenuAction } from './menuIds.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { RaidResult } from '../pve/application/RaidService.js';

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

/** Avoid loading DB/env until the production menu is actually used. */
export function lazyGameplay(): MenuGameplay {
	const load = async () => (await import('./MenuGameplayService.js')).menuGameplay;
	return {
		render: async (s) => (await load()).render(s),
		act: async (s, a, u, v) => (await load()).act(s, a, u, v),
	};
}
