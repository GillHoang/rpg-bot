import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 3,
	visibleWhen: (session) => session.screen.kind === 'quests',
	options: (_session, panel) => [
		{ label: GAMEPLAY_TEXT.rerollDaily, style: 'secondary', disabled: !!panel?.data?.rerollDisabled },
	],
	run: ({ session, api }) => api.beginConfirmation(session, 'reroll'),
} satisfies MenuItemSpec;
