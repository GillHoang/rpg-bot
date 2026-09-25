import type { MenuItemSpec } from '../../MenuItem.js';
import { GAMEPLAY_TEXT } from '../../../../shared/ui/text/gameplay.js';
import { ICONS } from '../../../../shared/ui/text/icons.js';

export default {
	kind: 'button',
	group: GAMEPLAY_TEXT.activityGroup,
	order: 12,
	visibleWhen: (session) => session.screen.kind === 'gateSelect',
	options: (_session, panel) =>
		(panel?.data?.gates ?? []).map((gate) => ({
			label: `Gate ${gate.id}`,
			value: String(gate.id),
			disabled: gate.disabled,
			style: 'secondary' as const,
			emoji: ICONS.nav.next,
		})),
	run: ({ session, value }) => {
		session.gateId = Number(value);
		session.portalGate = undefined;
		return { kind: 'gateTiers' };
	},
} satisfies MenuItemSpec;
