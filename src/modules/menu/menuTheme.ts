import { GAMEPLAY_TEXT } from '../../shared/ui/text/gameplay.js';
import { ICONS } from '../../shared/ui/text/icons.js';
import type { MenuSession } from './MenuSessionStore.js';

/**
 * Central menu look-and-feel (pokestar-style contextual theming): one place
 * for accent colors and the emoji shown on group headers. Items still own the
 * emoji on their own buttons.
 */

export const MENU_ACCENT = {
	/** Home / neutral surfaces. */
	home: 0xf1c232,
	/** Character & profile information. */
	info: 0x5865f2,
	/** Daily, quests and combat activity. */
	activity: 0x57f287,
	/** Destructive confirmations. */
	danger: 0xed4245,
} as const;

export const GROUP_EMOJI: Record<string, string> = {
	[GAMEPLAY_TEXT.infoGroup]: ICONS.menu.profile,
	[GAMEPLAY_TEXT.assetsGroup]: ICONS.menu.inventory,
	[GAMEPLAY_TEXT.activityGroup]: ICONS.menu.hunt,
	[GAMEPLAY_TEXT.confirmationGroup]: ICONS.status.success,
	[GAMEPLAY_TEXT.navigationGroup]: ICONS.menu.home,
};

export function groupHeading(group: string): string {
	const emoji = GROUP_EMOJI[group];
	return emoji ? `${emoji} ${group}` : group;
}

/** Accent color for the current screen, so each surface reads distinctly. */
export function menuAccent(session: MenuSession): number {
	switch (session.screen.kind) {
		case 'profile':
		case 'inventory':
		case 'deities':
			return MENU_ACCENT.info;
		case 'quests':
		case 'gateSelect':
		case 'gateTiers':
		case 'result':
		case 'log':
		case 'shop':
		case 'casino':
			return MENU_ACCENT.activity;
		case 'confirm':
			return MENU_ACCENT.danger;
		default:
			return MENU_ACCENT.home;
	}
}
