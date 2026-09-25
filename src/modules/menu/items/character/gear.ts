import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.infoGroup,
	order: 1,
	visibleWhen: (session) => session.screen.kind === 'profile',
	options: (session) => [
		{
			label: GAMEPLAY_TEXT.gearTab,
			style: session.profileTab === 'gear' ? 'primary' : 'secondary',
			emoji: ICONS.gear.weapon,
		},
	],
	run: ({ session }) => {
		session.profileTab = 'gear';
		return { kind: 'profile' };
	},
} satisfies MenuItemSpec;
