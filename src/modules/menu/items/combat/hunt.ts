import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { GATE_TEXT } from '../../../../shared/ui/text/portals.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 1,
	visibleWhen: (session, panel) => {
		if (panel?.classes) return false;
		if (session.screen.kind === 'result' || session.screen.kind === 'log') return !panel?.data?.boss;
		return ['home', 'profile', 'quests', 'gateTiers'].includes(session.screen.kind);
	},
	options: (session) => [
		{
			label:
				session.screen.kind === 'gateTiers' || session.screen.kind === 'result' || session.screen.kind === 'log'
					? GATE_TEXT.chooseGate
					: GAMEPLAY_TEXT.hunt,
			style: 'primary',
			emoji: ICONS.menu.hunt,
		},
	],
	run: ({ session }) => {
		session.gateId = undefined;
		session.portalGate = undefined;
		return { kind: 'gateSelect' };
	},
} satisfies MenuItemSpec;
