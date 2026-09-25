import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 6,
	visibleWhen: (session, panel) =>
		['gateSelect', 'gateTiers'].includes(session.screen.kind) && !!panel?.data?.hasBattle,
	options: () => [{ label: GAMEPLAY_TEXT.lastBattle, style: 'secondary' as const, emoji: ICONS.menu.hunt }],
	run: () => ({ kind: 'result' }),
} satisfies MenuItemSpec;
