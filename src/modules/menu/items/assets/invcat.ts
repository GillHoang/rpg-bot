import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { INVENTORY_CATEGORY_LABELS } from '../../../../shared/ui/text/inventory.js';
import { INVENTORY_CATEGORIES, isInventoryCategory } from '../../../../shared/ui/render/InventoryPager.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.assetsGroup,
	order: 0,
	visibleWhen: (session) => session.screen.kind === 'inventory',
	options: (session) => {
		const current = session.screen.kind === 'inventory' ? session.screen.category : 'bag';
		return INVENTORY_CATEGORIES.map((category) => ({
			label: INVENTORY_CATEGORY_LABELS[category] ?? category,
			value: category,
			style: current === category ? 'primary' : 'secondary',
		}));
	},
	run: ({ value }) => {
		const v = value ?? null;
		const category = isInventoryCategory(v) ? v : 'bag';
		return { kind: 'inventory', category, page: 1 };
	},
} satisfies MenuItemSpec;
