import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.infoGroup,
	order: 0,
	visibleWhen: (session, panel) => session.screen.kind === 'home' && !panel?.classes,
	options: () => [{ label: GAMEPLAY_TEXT.profile, style: 'primary' }],
	run: () => ({ kind: 'profile' }),
} satisfies MenuItemSpec;
