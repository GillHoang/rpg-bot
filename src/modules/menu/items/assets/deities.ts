import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.assetsGroup,
	order: 1,
	visibleWhen: (session, panel) => session.screen.kind === 'home' && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.deities, style: 'secondary', emoji: ICONS.menu.deity }],
	run: () => ({ kind: 'deities', page: 1 }),
} satisfies MenuItemSpec;
