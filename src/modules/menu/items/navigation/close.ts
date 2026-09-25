import type { MenuItemSpec } from '../../MenuItem.js';
import { MENU_TEXT } from '../../../../shared/ui/text/menu.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.navigationGroup,
	order: 3,
	visibleWhen: () => true,
	options: () => [{ label: MENU_TEXT.close, emoji: MENU_TEXT.close_emoji, style: 'danger' }],
	run: ({ session }) => session.screen,
} satisfies MenuItemSpec;
