import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.assetsGroup,
	order: 2,
	visibleWhen: (session, panel) => session.screen.kind === 'home' && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.shop, style: 'secondary', emoji: ICONS.menu.shop }],
	run: () => ({ kind: 'shop' }),
} satisfies MenuItemSpec;
