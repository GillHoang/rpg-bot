import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 10,
	visibleWhen: (session) => ['result', 'log'].includes(session.screen.kind),
	options: (_session, panel) => [
		{
			label: GAMEPLAY_TEXT.next,
			style: 'secondary',
			disabled: (panel?.data?.page ?? 0) >= (panel?.data?.pages ?? 1) - 1,
		},
	],
	run: ({ session, api }) => api.navigateLog(session, 'next'),
} satisfies MenuItemSpec;
