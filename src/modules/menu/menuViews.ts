import { GATE_TEXT } from '../../shared/ui/text/portals.js';
import { ICONS } from '../../shared/ui/text/icons.js';
import { MENU_VIEW_TEXT, MENU_SECTIONS, MENU_TEXT } from '../../shared/ui/text/menu.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	SectionBuilder,
	ThumbnailBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
	escapeMarkdown,
} from 'discord.js';
import { HELP_PAGES } from '../../shared/ui/text/help.js';

import type { GamePanel } from './MenuGameplay.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import { MENU_OPEN_ID, menuId, type MenuAction } from './menuIds.js';
import { CLASS_NAMES } from '../../shared/config/classes.js';
import { buildBattleLogPage } from '../../shared/ui/render/BattleLogPager.js';
import { raidBattleOptions } from '../../shared/ui/render/raidBattleOptions.js';
import { battleContinueButton } from './gameplayPanels.js';

function normalize(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/đ/gi, 'd')
		.toLowerCase();
}

export function helpMatches(query: string): number[] {
	const words = normalize(query).trim().split(/\s+/);
	return HELP_PAGES.flatMap((page, index) => {
		const text = normalize(`${page.title} ${page.body}`);
		return words.every((word) => text.includes(word)) ? [index] : [];
	});
}

/** Topic indexes selectable on a help/search screen (help = every page). */
export function availableTopics(screen: MenuScreen): number[] {
	if (screen.kind === 'help') return HELP_PAGES.map((_, index) => index);
	if (screen.kind === 'search') return helpMatches(screen.query).slice(0, 25);
	return [];
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

function viewContent(session: MenuSession) {
	const screen = session.screen;
	let title: string = MENU_TEXT.home;
	let body: string = MENU_TEXT.welcome;
	let topics: number[] = [];
	if (screen.kind === 'section') {
		({ title, body } = MENU_SECTIONS[screen.section]);
	} else if (screen.kind === 'help') {
		title = MENU_TEXT.help;
		body = MENU_TEXT.helpIntro;
		topics = HELP_PAGES.map((_, index) => index);
	} else if (screen.kind === 'topic') {
		const page = HELP_PAGES[screen.index]!;
		title = page.title;
		body = page.body;
	} else if (screen.kind === 'search') {
		title = `${MENU_TEXT.search}: ${escapeMarkdown(screen.query)}`;
		topics = helpMatches(screen.query);
		body = topics.length ? MENU_TEXT.chooseTopic : MENU_TEXT.noResults;
	}
	if (session.gamePanel) ({ title, body } = session.gamePanel);
	if (session.notice) body = `${session.notice}\n\n${body}`;
	return { title, body, topics };
}

function gameplayButton(session: MenuSession, button: GamePanel['buttons'][number], emoji?: string) {
	let style = ButtonStyle.Secondary;
	if (button.danger) style = ButtonStyle.Danger;
	else if (['confirm', 'profile', 'hunt', 'fight'].includes(button.action)) style = ButtonStyle.Primary;
	const component = new ButtonBuilder()
		.setCustomId(menuId(session.id, session.revision, button.action, button.value))
		.setLabel(button.label)
		.setDisabled(!!button.disabled)
		.setStyle(style);
	if (emoji) component.setEmoji(emoji);
	return component;
}

function addGameplayButtons(container: ContainerBuilder, session: MenuSession): void {
	const buttons = session.gamePanel?.buttons ?? [];
	const groups = session.gamePanel?.grouped ? [...new Set(buttons.map((b) => b.group))] : [undefined];
	const emoji: Partial<Record<MenuAction, string>> = {
		profile: ICONS.menu.profile,
		help: ICONS.menu.help,
		search: ICONS.menu.search,
		daily: ICONS.menu.daily,
		hunt: ICONS.menu.hunt,
		boss: ICONS.menu.boss,
		quests: ICONS.menu.quests,
		inventory: ICONS.menu.inventory,
		deity: ICONS.menu.deity,
		shop: ICONS.menu.shop,
		casino: ICONS.menu.casino,
	};
	for (const group of groups) {
		if (group) {
			container.addSeparatorComponents((s) => s.setDivider(true));
			container.addTextDisplayComponents((t) => t.setContent(`### ${group}`));
		}
		const groupedButtons = group ? buttons.filter((b) => b.group === group) : buttons;
		for (let i = 0; i < groupedButtons.length; i += 5)
			container.addActionRowComponents(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					groupedButtons.slice(i, i + 5).map((b) => gameplayButton(session, b, emoji[b.action])),
				),
			);
	}
}

function battleMenuView(session: MenuSession, battle: NonNullable<MenuSession['battle']>) {
	const continuation = battleContinueButton(battle);
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
	const rows = [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			gameplayButton(session, { action: 'home', label: MENU_TEXT.home }, MENU_TEXT.home_emoji),
			...(continuation ? [gameplayButton(session, continuation, ICONS.menu.hunt)] : []),
			...(!battle.boss
				? [gameplayButton(session, { action: 'hunt', label: GATE_TEXT.chooseGate }, ICONS.menu.hunt)]
				: []),
		),
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
	for (const selector of session.gamePanel?.selectors ?? []) {
		container.addActionRowComponents(
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(id(selector.action))
					.setPlaceholder(selector.placeholder)
					.addOptions(selector.options),
			),
		);
	}
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

function addSectionSelector(
	container: ContainerBuilder,
	session: MenuSession,
	screen: MenuSession['screen'],
	id: (action: MenuAction) => string,
): void {
	if (screen.kind === 'gateSelect' || screen.kind === 'gateTiers') return;
	if (session.gamePanel?.grouped || session.gamePanel?.classes) return;
	container.addActionRowComponents(
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(id('section'))
				.setPlaceholder(MENU_TEXT.chooseSection)
				.addOptions(
					Object.entries(MENU_SECTIONS).map(([value, section]) => ({
						label: section.title,
						value,
						default: screen.kind === 'section' && screen.section === value,
					})),
				),
		),
	);
}

function addTopicSelector(container: ContainerBuilder, topics: number[], id: (action: MenuAction) => string): void {
	if (!topics.length) return;
	container.addActionRowComponents(
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(id('topic'))
				.setPlaceholder(MENU_TEXT.chooseTopic)
				.addOptions(
					topics.slice(0, 25).map((index) => ({ label: HELP_PAGES[index]!.title, value: String(index) })),
				),
		),
	);
}

function addHelpActions(container: ContainerBuilder, session: MenuSession, id: (action: MenuAction) => string): void {
	if (session.screen.kind === 'gateSelect' || session.screen.kind === 'gateTiers') return;
	if (session.gamePanel?.grouped || session.gamePanel?.classes) return;
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(id('help')).setLabel(MENU_TEXT.help).setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId(id('search')).setLabel(MENU_TEXT.search).setStyle(ButtonStyle.Secondary),
		),
	);
}

function addNavigation(container: ContainerBuilder, session: MenuSession, screen: MenuSession['screen']): void {
	const id = (action: MenuAction) => menuId(session.id, session.revision, action);
	container.addSeparatorComponents((s) => s.setDivider(true));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(id('back'))
				.setLabel(MENU_TEXT.back)
				.setEmoji(MENU_TEXT.back_emoji)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(!session.history.length),
			new ButtonBuilder()
				.setCustomId(id('home'))
				.setLabel(MENU_TEXT.home)
				.setEmoji(MENU_TEXT.home_emoji)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(screen.kind === 'home'),
			new ButtonBuilder()
				.setCustomId(id('refresh'))
				.setLabel(MENU_TEXT.refresh)
				.setEmoji(MENU_TEXT.refresh_emoji)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(id('close'))
				.setLabel(MENU_TEXT.close)
				.setEmoji(MENU_TEXT.close_emoji)
				.setStyle(ButtonStyle.Danger),
		),
	);
	if (screen.kind !== 'gateSelect' && screen.kind !== 'gateTiers') {
		container.addTextDisplayComponents((t) => t.setContent(MENU_TEXT.footer));
	}
}

export function menuView(session: MenuSession) {
	if (session.battle && (session.screen.kind === 'result' || session.screen.kind === 'log')) {
		return battleMenuView(session, session.battle);
	}
	const id = (action: MenuAction) => menuId(session.id, session.revision, action);
	const container = new ContainerBuilder().setAccentColor(0xf1c232);
	const screen = session.screen;
	const { title, body, topics } = viewContent(session);
	container.addTextDisplayComponents((t) => t.setContent(MENU_VIEW_TEXT.heading(title)));
	addMenuBody(container, session, body);
	addClassSelector(container, session, id);
	addGameplayButtons(container, session);
	addSectionSelector(container, session, screen, id);
	addTopicSelector(container, topics, id);
	addHelpActions(container, session, id);
	addNavigation(container, session, screen);
	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2 as const,
		allowedMentions: { parse: [] as [] },
	};
}

export function searchModal(session: MenuSession, nonce: string) {
	return new ModalBuilder()
		.setCustomId(menuId(session.id, session.revision, 'find', nonce))
		.setTitle(MENU_TEXT.search)
		.addLabelComponents(
			new LabelBuilder()
				.setLabel(MENU_TEXT.searchLabel)
				.setTextInputComponent(
					new TextInputBuilder()
						.setCustomId('query')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder(MENU_TEXT.searchPlaceholder)
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(80),
				),
		);
}
