import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 8,
	visibleWhen: (session) => ['result', 'log'].includes(session.screen.kind),
	options: (_session, panel) => [
		{ label: GAMEPLAY_TEXT.first, style: 'secondary', emoji: ICONS.nav.first, disabled: (panel?.data?.page ?? 0) <= 0 },
	],
	run: ({ session, api }) => api.navigateLog(session, 'first'),
} satisfies MenuItemSpec;
