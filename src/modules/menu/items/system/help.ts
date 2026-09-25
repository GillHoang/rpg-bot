import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.infoGroup,
	order: 1,
	visibleWhen: (session, panel) => session.screen.kind === 'home' && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.help, style: 'secondary', emoji: ICONS.menu.help }],
	run: ({ session }) => {
		session.notice = GAMEPLAY_TEXT.helpLink;
		return session.screen;
	},
} satisfies MenuItemSpec;
