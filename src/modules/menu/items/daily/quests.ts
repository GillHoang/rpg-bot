import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 3,
	visibleWhen: (session, panel) =>
		['home', 'gateSelect', 'gateTiers'].includes(session.screen.kind) && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.quests, style: 'secondary', emoji: ICONS.menu.quests }],
	run: () => ({ kind: 'quests' }),
} satisfies MenuItemSpec;
