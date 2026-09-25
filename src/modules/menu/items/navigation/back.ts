import type { MenuItemSpec } from '../../MenuItem.js';
import { MENU_TEXT } from '../../../../shared/ui/text/menu.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.navigationGroup,
	order: 1,
	visibleWhen: () => true,
	options: (session) => [
		{
			label: MENU_TEXT.back,
			emoji: MENU_TEXT.back_emoji,
			style: 'secondary',
			disabled: session.history.length === 0,
		},
	],
	run: ({ session }) => session.screen,
} satisfies MenuItemSpec;
