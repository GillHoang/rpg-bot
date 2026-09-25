import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.confirmationGroup,
	order: 1,
	visibleWhen: (session) => session.screen.kind === 'confirm',
	options: () => [{ label: GAMEPLAY_TEXT.cancel, style: 'secondary' }],
	run: ({ session, api }) => api.cancel(session),
} satisfies MenuItemSpec;
