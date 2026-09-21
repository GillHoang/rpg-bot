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
import { HELP_PAGES } from '../text/help.js';
import { MENU_SECTIONS, MENU_TEXT } from '../text/menu.js';
import type { MenuSession } from './MenuSessionStore.js';
import { MENU_OPEN_ID, menuId, type MenuAction } from './menuIds.js';
import { CLASS_NAMES } from '../config/classes.js';

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

export function menuView(session: MenuSession) {
	const id = (action: MenuAction) => menuId(session.id, session.revision, action);
	const container = new ContainerBuilder().setAccentColor(0xf1c232);
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
	container.addTextDisplayComponents((t) => t.setContent(`## CREDD · ${title}`));
	// Reserve room within the V2 message text budget for the title/footer.
	if (session.gamePanel?.withAvatar && session.avatarUrl) {
		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents((t) => t.setContent(body.slice(0, 3400)))
				.setThumbnailAccessory(
					new ThumbnailBuilder().setURL(session.avatarUrl).setDescription('Avatar nhân vật'),
				),
		);
	} else container.addTextDisplayComponents((t) => t.setContent(body.slice(0, 3400)));
	if (session.gamePanel?.classes)
		container.addActionRowComponents(
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(id('class'))
					.setPlaceholder('Chọn class để xem trước')
					.addOptions(CLASS_NAMES.map((value) => ({ label: value, value }))),
			),
		);
	const buttons = session.gamePanel?.buttons ?? [];
	const groups = session.gamePanel?.grouped ? [...new Set(buttons.map((b) => b.group))] : [undefined];
	const emoji: Partial<Record<MenuAction, string>> = {
		profile: '👤',
		help: '📖',
		search: '🔎',
		daily: '🎁',
		hunt: '⚔️',
		boss: '🐉',
		quests: '📜',
		inventory: '🎒',
		deity: '✨',
		shop: '🛒',
		casino: '🎲',
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
					groupedButtons.slice(i, i + 5).map((b) => {
						const component = new ButtonBuilder()
							.setCustomId(id(b.action))
							.setLabel(b.label)
							.setDisabled(!!b.disabled)
							.setStyle(
								b.danger
									? ButtonStyle.Danger
									: ['confirm', 'profile', 'hunt'].includes(b.action)
										? ButtonStyle.Primary
										: ButtonStyle.Secondary,
							);
						if (emoji[b.action]) component.setEmoji(emoji[b.action]!);
						return component;
					}),
				),
			);
	}
	if (!session.gamePanel?.grouped)
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
	if (topics.length) {
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
	if (!session.gamePanel?.grouped)
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId(id('help')).setLabel(MENU_TEXT.help).setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(id('search'))
					.setLabel(MENU_TEXT.search)
					.setStyle(ButtonStyle.Secondary),
			),
		);
	container.addSeparatorComponents((s) => s.setDivider(true));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(id('back'))
				.setLabel(MENU_TEXT.back)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(!session.history.length),
			new ButtonBuilder()
				.setCustomId(id('home'))
				.setLabel(MENU_TEXT.home)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(screen.kind === 'home'),
			new ButtonBuilder().setCustomId(id('refresh')).setLabel(MENU_TEXT.refresh).setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId(id('close')).setLabel(MENU_TEXT.close).setStyle(ButtonStyle.Danger),
		),
	);
	container.addTextDisplayComponents((t) => t.setContent(MENU_TEXT.footer));
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
