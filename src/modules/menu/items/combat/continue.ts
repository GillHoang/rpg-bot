import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 7,
	visibleWhen: (session, panel) => ['result', 'log'].includes(session.screen.kind) && !!panel?.data?.continuation,
	options: (_session, panel) => [
		{ label: panel?.data?.continuation?.label ?? '', style: 'primary', emoji: ICONS.nav.next },
	],
	run: ({ session, api }) => api.continueBattle(session),
} satisfies MenuItemSpec;
