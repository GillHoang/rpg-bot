import type { MenuItemSpec } from '../../MenuItem.js';
import { MENU_TEXT } from '../../../../shared/ui/text/menu.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.navigationGroup,
	order: 2,
	visibleWhen: () => true,
	options: () => [{ label: MENU_TEXT.refresh, emoji: MENU_TEXT.refresh_emoji, style: 'secondary' }],
	run: ({ session }) => session.screen,
} satisfies MenuItemSpec;
