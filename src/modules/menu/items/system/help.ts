import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.infoGroup,
	order: 1,
	visibleWhen: (session, panel) => session.screen.kind === 'home' && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.help, style: 'secondary' }],
	run: ({ session }) => {
		session.notice = GAMEPLAY_TEXT.helpLink;
		return session.screen;
	},
} satisfies MenuItemSpec;
