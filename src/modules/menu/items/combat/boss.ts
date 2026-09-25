import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 2,
	visibleWhen: (session, panel) =>
		['home', 'gateSelect', 'gateTiers'].includes(session.screen.kind) && !panel?.classes,
	options: (_session, panel) => [
		{ label: GAMEPLAY_TEXT.boss, style: 'secondary', disabled: !!panel?.data?.bossDisabled },
	],
	run: ({ session, api }) => api.beginConfirmation(session, 'boss'),
} satisfies MenuItemSpec;
