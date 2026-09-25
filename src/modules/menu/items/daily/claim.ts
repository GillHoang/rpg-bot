import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 2,
	visibleWhen: (session) => session.screen.kind === 'quests',
	options: (_session, panel) => [
		{ label: GAMEPLAY_TEXT.claimWeekly, style: 'success', disabled: !!panel?.data?.claimDisabled },
	],
	run: ({ session, api }) => api.claimGrand(session),
} satisfies MenuItemSpec;
