import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 0,
	visibleWhen: (session, panel) => ['home', 'quests'].includes(session.screen.kind) && !panel?.classes,
	options: (_session, panel) => [
		{
			label: panel?.data?.dailyDone ? GAMEPLAY_TEXT.dailyClaimed : GAMEPLAY_TEXT.dailyClaim,
			style: 'secondary',
			disabled: !!panel?.data?.dailyDone,
		},
	],
	run: ({ session, api }) => api.claimDaily(session),
} satisfies MenuItemSpec;
