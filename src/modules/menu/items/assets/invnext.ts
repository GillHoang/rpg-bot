import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { INVENTORY_NEXT_LABEL } from '../../../../shared/ui/text/inventory.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.assetsGroup,
	order: 11,
	visibleWhen: (session, panel) => session.screen.kind === 'inventory' && (panel?.data?.pages ?? 1) > 1,
	options: (_session, panel) => [
		{
			label: INVENTORY_NEXT_LABEL,
			style: 'secondary',
			emoji: ICONS.nav.next,
			disabled: (panel?.data?.page ?? 1) >= (panel?.data?.pages ?? 1),
		},
	],
	run: ({ session }) => {
		if (session.screen.kind !== 'inventory') return { kind: 'inventory', category: 'bag', page: 1 };
		return {
			kind: 'inventory',
			category: session.screen.category,
			page: session.screen.page + 1,
		};
	},
} satisfies MenuItemSpec;
