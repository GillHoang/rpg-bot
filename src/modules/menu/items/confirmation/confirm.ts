import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.confirmationGroup,
	order: 0,
	visibleWhen: (session) => session.screen.kind === 'confirm',
	options: (session) => {
		const start = session.screen.kind === 'confirm' && session.screen.operation === 'start';
		return [
			{
				label: start ? GAMEPLAY_TEXT.createCharacter : GAMEPLAY_TEXT.confirm,
				style: start ? ('primary' as const) : ('danger' as const),
				emoji: start ? ICONS.status.success : ICONS.menu.close,
			},
		];
	},
	run: ({ session, username, api }) => api.confirm(session, username),
} satisfies MenuItemSpec;
