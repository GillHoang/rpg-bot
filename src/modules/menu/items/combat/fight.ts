import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { GATE_TEXT } from '../../../../shared/ui/text/portals.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 12,
	ownRow: true,
	visibleWhen: (session) => session.screen.kind === 'gateTiers',
	options: (_session, panel) =>
		(panel?.data?.tiers ?? []).map((tier) => ({
			label: GATE_TEXT.fightTier(tier.number),
			value: String(tier.number),
			disabled: tier.disabled,
			style: 'primary' as const,
			emoji: ICONS.menu.hunt,
		})),
	run: ({ session, value, api }) => api.fightTier(session, value),
} satisfies MenuItemSpec;
