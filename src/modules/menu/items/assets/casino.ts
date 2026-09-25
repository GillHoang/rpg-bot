import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.assetsGroup,
	order: 3,
	visibleWhen: (session, panel) => session.screen.kind === 'home' && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.casino, style: 'secondary', emoji: ICONS.menu.casino }],
	run: () => ({ kind: 'casino' }),
} satisfies MenuItemSpec;
