import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 3,
	visibleWhen: (session, panel) =>
		['home', 'gateSelect', 'gateTiers'].includes(session.screen.kind) && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.quests, style: 'secondary' }],
	run: () => ({ kind: 'quests' }),
} satisfies MenuItemSpec;
