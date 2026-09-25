import type { MenuItemSpec } from '../../MenuItem.js';
import { MENU_TEXT } from '../../../../shared/ui/text/menu.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.navigationGroup,
	order: 0,
	visibleWhen: () => true,
	options: (session) => [
		{
			label: MENU_TEXT.home,
			emoji: MENU_TEXT.home_emoji,
			style: 'secondary',
			disabled: session.screen.kind === 'home',
		},
	],
	run: ({ session }) => session.screen,
} satisfies MenuItemSpec;
