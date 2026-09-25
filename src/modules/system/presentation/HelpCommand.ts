import { LOG_EVENT_TEXT } from '../../../shared/ui/text/diagnostics.js';
import {
	HELP_FLOW_TEXT,
	HELP_BETA_NOTICE,
	HELP_DESCRIPTION,
	HELP_FOOTER,
	HELP_NEXT_LABEL,
	HELP_PAGE_INDICATOR,
	HELP_PAGES,
	HELP_PAGER_TTL_MS,
	HELP_PREV_LABEL,
	HELP_SELECT_PLACEHOLDER,
	HELP_TITLE,
} from '../../../shared/ui/text/help.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Message,
	type StringSelectMenuInteraction,
} from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { logger } from '../../../shared/utils/logger.js';

const prevCustomId = (page: number): string => `help:prev:${page}`;
const nextCustomId = (page: number): string => `help:next:${page}`;

function topicRow(): ActionRowBuilder<StringSelectMenuBuilder> {
	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId('help:select')
			.setPlaceholder(HELP_SELECT_PLACEHOLDER)
			.addOptions(HELP_PAGES.map((page, index) => ({ label: page.title, value: String(index + 1) }))),
	);
}

function pagerRow(page: number, total: number): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(prevCustomId(page))
			.setLabel(HELP_PREV_LABEL)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page <= 1),
		new ButtonBuilder()
			.setCustomId('help:indicator')
			.setLabel(HELP_PAGE_INDICATOR(page, total))
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true),
		new ButtonBuilder()
			.setCustomId(nextCustomId(page))
			.setLabel(HELP_NEXT_LABEL)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page >= total),
	);
}

function helpEmbed(page: number): EmbedBuilder {
	const entry = HELP_PAGES[page - 1]!;
	return new EmbedBuilder()
		.setTitle(HELP_TITLE(entry.title))
		.setDescription(`${HELP_BETA_NOTICE}\n\n${entry.body}`.slice(0, 4000))
		.setFooter({ text: HELP_FOOTER });
}

/**
 * Sổ tay người chơi: /help mở trang 1, nút Trước/Sau lật qua các phần
 (bắt đầu → daily → deity → gear/rune → PvP → cosmetic). Phân trang theo
 đúng mẫu /inventory: collector trên message gốc, TTL hết hạn thì gỡ nút,
 chỉ chủ lệnh bấm được (reply ephemeral). Beta notice ghim đầu mỗi trang.
 */
export class HelpCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('help').setDescription(HELP_DESCRIPTION);

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const total = HELP_PAGES.length;
		const view = (page: number) => ({
			embeds: [helpEmbed(page)],
			components: total > 1 ? [topicRow(), pagerRow(page, total)] : [topicRow()],
		});

		const message: Message = await interaction.editReply(view(1));

		const collector = message.createMessageComponentCollector({
			time: HELP_PAGER_TTL_MS,
			filter: (component) => component.user.id === interaction.user.id,
		});
		collector.on('collect', async (component: ButtonInteraction | StringSelectMenuInteraction) => {
			try {
				let page: number | undefined;
				if (component.isStringSelectMenu()) {
					page = Number(component.values[0]);
				} else if (component.isButton() && component.customId !== 'help:indicator') {
					const [, action, pageRaw] = component.customId.split(':');
					if (pageRaw === undefined || Number.isNaN(Number(pageRaw))) return;
					page = Number(pageRaw) + (action === 'next' ? 1 : -1);
				}
				if (page === undefined || Number.isNaN(page)) return;
				await component.update(view(Math.min(Math.max(page, 1), total)));
			} catch (error) {
				logger.error({ err: error, discordId: component.user.id }, LOG_EVENT_TEXT.helpPageFailed);
				await component.reply({ content: HELP_FLOW_TEXT.failed, ephemeral: true }).catch(() => undefined);
			}
		});
		collector.on('end', async () => {
			// Hết giờ — gỡ nút, giữ nguyên embed đang hiển thị.
			await message.edit({ components: [] }).catch(() => undefined);
		});
	}
}
