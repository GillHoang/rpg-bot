import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 3,
	visibleWhen: (session) => session.screen.kind === 'quests',
	options: (_session, panel) => [
		{ label: GAMEPLAY_TEXT.rerollDaily, style: 'secondary', emoji: ICONS.menu.refresh, disabled: !!panel?.data?.rerollDisabled },
	],
	run: ({ session, api }) => api.beginConfirmation(session, 'reroll'),
} satisfies MenuItemSpec;
