import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { INVENTORY_PREV_LABEL } from '../../../../shared/ui/text/inventory.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.assetsGroup,
	order: 10,
	visibleWhen: (session, panel) => session.screen.kind === 'deities' && (panel?.data?.pages ?? 1) > 1,
	options: (_session, panel) => [
		{
			label: INVENTORY_PREV_LABEL,
			style: 'secondary',
			emoji: ICONS.nav.prev,
			disabled: (panel?.data?.page ?? 1) <= 1,
		},
	],
	run: ({ session }) => {
		if (session.screen.kind !== 'deities') return { kind: 'deities', page: 1 };
		return { kind: 'deities', page: Math.max(1, session.screen.page - 1) };
	},
} satisfies MenuItemSpec;
