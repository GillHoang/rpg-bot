import { MENU_VIEW_TEXT, MENU_SECTIONS, MENU_TEXT } from '../../shared/ui/text/menu.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	MessageFlags,
	SectionBuilder,
	StringSelectMenuBuilder,
	ThumbnailBuilder,
} from 'discord.js';
import type { GamePanelButton } from './MenuGameplay.js';
import type { MenuSession } from './MenuSessionStore.js';
import { MENU_OPEN_ID, menuId, type MenuAction } from './menuIds.js';
import { CLASS_NAMES } from '../../shared/config/classes.js';
import { buildBattleLogPage } from '../../shared/ui/render/BattleLogPager.js';
import { raidBattleOptions } from '../../shared/ui/render/raidBattleOptions.js';
import { menuButton, buildPanelButtons } from './MenuRegistry.js';
import { groupHeading, menuAccent } from './menuTheme.js';

function buttonStyle(style?: string): ButtonStyle {
	switch (style) {
		case 'primary':
			return ButtonStyle.Primary;
		case 'success':
			return ButtonStyle.Success;
		case 'danger':
			return ButtonStyle.Danger;
		default:
			return ButtonStyle.Secondary;
	}
}

function viewContent(session: MenuSession) {
	let title: string = MENU_TEXT.home;
	let body: string = MENU_TEXT.welcome;
	const screen = session.screen;
	if (screen.kind === 'section') ({ title, body } = MENU_SECTIONS[screen.section]);
	if (session.gamePanel) ({ title, body } = session.gamePanel);
	if (session.notice) body = `${session.notice}\n\n${body}`;
	return { title, body };
}

function gameplayButton(session: MenuSession, button: GamePanelButton) {
	const component = new ButtonBuilder()
		.setCustomId(menuId(session.id, session.revision, button.action, button.value))
		.setLabel(button.label)
		.setDisabled(!!button.disabled)
		.setStyle(buttonStyle(button.style));
	if (button.emoji) component.setEmoji(button.emoji);
	return component;
}

/** Buttons come pre-built from the registry (`session.gamePanel.buttons`); fall back to synthesizing them. */
function addGameplayButtons(container: ContainerBuilder, session: MenuSession): void {
	const buttons = session.gamePanel?.buttons ?? buildPanelButtons(session, session.gamePanel);
	if (!buttons.length) return;
	// Always separate groups so navigation never wraps into a combat row, but
	// only print a heading when there is more than one group on screen.
	const groups = [...new Set(buttons.map((b) => b.group ?? ''))];
	const showHeaders = groups.length > 1;
	for (const group of groups) {
		if (showHeaders && group) {
			container.addSeparatorComponents((s) => s.setDivider(true));
			container.addTextDisplayComponents((t) => t.setContent(`### ${groupHeading(group)}`));
		}
		const grouped = group ? buttons.filter((b) => (b.group ?? '') === group) : buttons;
		for (let i = 0; i < grouped.length; i += 5)
			container.addActionRowComponents(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					grouped.slice(i, i + 5).map((b) => gameplayButton(session, b)),
				),
			);
	}
}

function battleMenuView(session: MenuSession, battle: NonNullable<MenuSession['battle']>) {
	const container = buildBattleLogPage(
		raidBattleOptions(battle, battle.boss, session.playerName ?? MENU_VIEW_TEXT.player),
		session.screen.kind === 'log' ? session.screen.page : battle.battle.roundLogs.length - 1,
		{
			navigation: true,
			customIds: {
				first: menuId(session.id, session.revision, 'first'),
				prev: menuId(session.id, session.revision, 'prev'),
				next: menuId(session.id, session.revision, 'next'),
				last: menuId(session.id, session.revision, 'last'),
			},
		},
	).components[0];
	if (session.notice) container.addTextDisplayComponents((t) => t.setContent(session.notice!));
	const row = ['home', 'continue', 'hunt']
		.map((name) => menuButton(session, name, session.gamePanel))
		.filter((button): button is GamePanelButton => button !== undefined);
	const rows = [
		new ActionRowBuilder<ButtonBuilder>().addComponents(row.map((button) => gameplayButton(session, button))),
	];
	return {
		components: [container, ...rows],
		flags: MessageFlags.IsComponentsV2 as const,
		allowedMentions: { parse: [] as [] },
	};
}

function addMenuBody(container: ContainerBuilder, session: MenuSession, body: string): void {
	const content = body.slice(0, 3400);
	if (session.gamePanel?.withAvatar && session.avatarUrl) {
		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents((t) => t.setContent(content))
				.setThumbnailAccessory(
					new ThumbnailBuilder().setURL(session.avatarUrl).setDescription(MENU_VIEW_TEXT.avatar),
				),
		);
		return;
	}
	container.addTextDisplayComponents((t) => t.setContent(content));
}

function addClassSelector(container: ContainerBuilder, session: MenuSession, id: (action: MenuAction) => string): void {
	if (!session.gamePanel?.classes) return;
	container.addActionRowComponents(
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(id('class'))
				.setPlaceholder(MENU_VIEW_TEXT.chooseClass)
				.addOptions(CLASS_NAMES.map((value) => ({ label: value, value }))),
		),
	);
}

export function menuView(session: MenuSession) {
	if (session.battle && (session.screen.kind === 'result' || session.screen.kind === 'log')) {
		return battleMenuView(session, session.battle);
	}
	const id = (action: MenuAction) => menuId(session.id, session.revision, action);
	const container = new ContainerBuilder().setAccentColor(menuAccent(session));
	const { title, body } = viewContent(session);
	container.addTextDisplayComponents((t) => t.setContent(MENU_VIEW_TEXT.heading(title)));
	addMenuBody(container, session, body);
	addClassSelector(container, session, id);
	addGameplayButtons(container, session);
	if (session.screen.kind !== 'gateSelect' && session.screen.kind !== 'gateTiers') {
		container.addSeparatorComponents((s) => s.setDivider(true));
		container.addTextDisplayComponents((t) => t.setContent(MENU_TEXT.footer));
	}
	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2 as const,
		allowedMentions: { parse: [] as [] },
	};
}

export function recoveryView(text: string) {
	const container = new ContainerBuilder()
		.setAccentColor(0x5865f2)
		.addTextDisplayComponents((t) => t.setContent(text))
		.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId(MENU_OPEN_ID).setLabel(MENU_TEXT.open).setStyle(ButtonStyle.Primary),
			),
		);
	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2 as const,
		allowedMentions: { parse: [] as [] },
	};
}
