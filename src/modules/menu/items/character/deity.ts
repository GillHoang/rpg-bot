import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.infoGroup,
	order: 2,
	visibleWhen: (session) => session.screen.kind === 'profile',
	options: (session) => [
		{
			label: GAMEPLAY_TEXT.deityTab,
			style: session.profileTab === 'deity' ? 'primary' : 'secondary',
			emoji: ICONS.menu.deity,
		},
	],
	run: ({ session }) => {
		session.profileTab = 'deity';
		return { kind: 'profile' };
	},
} satisfies MenuItemSpec;
