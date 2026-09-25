import { GAMEPLAY_TEXT } from '../../shared/ui/text/gameplay.js';
import { INVENTORY_NEXT_LABEL, INVENTORY_PREV_LABEL } from '../../shared/ui/text/inventory.js';
import { ICONS } from '../../shared/ui/text/icons.js';
import type { MenuItemSpec } from './MenuItem.js';

/**
 * Shared factory for the read-only asset pager buttons (P2). The four
 * inventory/deities prev/next items differ only in screen kind, direction
 * label/icon and page math — one factory keeps them from drifting apart
 * (and from tripping duplication gates). Each thin file under
 * `items/assets/` re-exports a single call of this factory so the
 * file-per-element registry contract stays intact.
 */
export function makeAssetPagerItem(
	screen: 'inventory' | 'deities',
	direction: 'prev' | 'next',
): MenuItemSpec {
	const isPrev = direction === 'prev';
	return {
		kind: 'button',
		group: GAMEPLAY_TEXT.assetsGroup,
		order: isPrev ? 10 : 11,
		visibleWhen: (session, panel) => session.screen.kind === screen && (panel?.data?.pages ?? 1) > 1,
		options: (_session, panel) => [
			{
				label: isPrev ? INVENTORY_PREV_LABEL : INVENTORY_NEXT_LABEL,
				style: 'secondary',
				emoji: isPrev ? ICONS.nav.prev : ICONS.nav.next,
				disabled: isPrev
					? (panel?.data?.page ?? 1) <= 1
					: (panel?.data?.page ?? 1) >= (panel?.data?.pages ?? 1),
			},
		],
		run: ({ session }) => {
			if (screen === 'deities') {
				const page = session.screen.kind === 'deities' ? session.screen.page : 1;
				return { kind: 'deities', page: isPrev ? Math.max(1, page - 1) : page + 1 };
			}
			if (session.screen.kind !== 'inventory') return { kind: 'inventory', category: 'bag', page: 1 };
			const page = session.screen.page;
			return {
				kind: 'inventory',
				category: session.screen.category,
				page: isPrev ? Math.max(1, page - 1) : page + 1,
			};
		},
	};
}
