import { GAMEPLAY_TEXT } from '../../shared/ui/text/gameplay.js';
import { MENU_ITEMS } from './items/registry.generated.js';
import type { MenuButtonOption, MenuItem } from './MenuItem.js';
import type { GamePanel, GamePanelButton } from './MenuGameplay.js';
import type { MenuSession } from './MenuSessionStore.js';
import type { MenuAction } from './menuIds.js';

const byName = new Map<string, MenuItem>(MENU_ITEMS.map((item) => [item.name, item]));

/** Display order of the built-in groups; unknown (freestyle) groups follow, by first appearance. */
const GROUP_ORDER = [
	GAMEPLAY_TEXT.infoGroup,
	GAMEPLAY_TEXT.activityGroup,
	GAMEPLAY_TEXT.assetsGroup,
	GAMEPLAY_TEXT.confirmationGroup,
	GAMEPLAY_TEXT.navigationGroup,
];

export function getMenuItem(name: string): MenuItem | undefined {
	return byName.get(name);
}

/** Navigation items are handled by the router (session/history lifecycle), not gameplay. */
export function isNavigationAction(name: string): boolean {
	return byName.get(name)?.category === 'navigation';
}

function toPanelButton(item: MenuItem, option: MenuButtonOption): GamePanelButton {
	return {
		action: item.name as MenuAction,
		label: option.label,
		value: option.value,
		disabled: option.disabled,
		danger: option.style === 'danger',
		style: option.style,
		emoji: option.emoji,
		group: item.group ?? item.category,
	};
}

/** One rendered button for a named item, or undefined when it is not visible here. */
export function menuButton(
	session: MenuSession,
	name: string,
	panel: GamePanel | undefined,
): GamePanelButton | undefined {
	const item = byName.get(name);
	if (!item || !item.visibleWhen(session, panel)) return undefined;
	const [option] = item.options(session, panel);
	return option ? toPanelButton(item, option) : undefined;
}

/** Every button visible on the current screen, grouped in display order. */
export function buildPanelButtons(session: MenuSession, panel: GamePanel | undefined): GamePanelButton[] {
	const rows: { rank: number; order: number; index: number; button: GamePanelButton }[] = [];
	const groupRank = new Map(GROUP_ORDER.map((group, index) => [group, index]));
	let unknownRank = GROUP_ORDER.length;
	const seenUnknown = new Map<string, number>();
	let index = 0;
	for (const item of MENU_ITEMS) {
		if (!item.visibleWhen(session, panel)) continue;
		const group = item.group ?? item.category;
		let rank = groupRank.get(group);
		if (rank === undefined) {
			rank = seenUnknown.get(group) ?? unknownRank++;
			seenUnknown.set(group, rank);
		}
		for (const option of item.options(session, panel)) {
			rows.push({ rank, order: item.order ?? 0, index: index++, button: toPanelButton(item, option) });
		}
	}
	rows.sort((a, b) => a.rank - b.rank || a.order - b.order || a.index - b.index);
	return rows.map((row) => row.button);
}

export { MENU_ITEMS };
