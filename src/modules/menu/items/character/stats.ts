import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.infoGroup,
	order: 0,
	visibleWhen: (session) => session.screen.kind === 'profile',
	options: (session) => [
		{
			label: GAMEPLAY_TEXT.statsTab,
			style: (session.profileTab ?? 'stats') === 'stats' ? 'primary' : 'secondary',
			emoji: ICONS.battle.health,
		},
	],
	run: ({ session }) => {
		session.profileTab = 'stats';
		return { kind: 'profile' };
	},
} satisfies MenuItemSpec;
