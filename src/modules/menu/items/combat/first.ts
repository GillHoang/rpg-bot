import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 8,
	visibleWhen: (session) => ['result', 'log'].includes(session.screen.kind),
	options: (_session, panel) => [
		{ label: GAMEPLAY_TEXT.first, style: 'secondary', disabled: (panel?.data?.page ?? 0) <= 0 },
	],
	run: ({ session, api }) => api.navigateLog(session, 'first'),
} satisfies MenuItemSpec;
