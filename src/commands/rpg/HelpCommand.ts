import { HELP_FLOW_TEXT } from '../../text/help.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	EmbedBuilder,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Message,
} from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { logger } from '../../utils/logger.js';
import {
	HELP_BETA_NOTICE,
	HELP_DESCRIPTION,
	HELP_FOOTER,
	HELP_NEXT_LABEL,
	HELP_PAGE_INDICATOR,
	HELP_PAGES,
	HELP_PAGER_TTL_MS,
	HELP_PREV_LABEL,
	HELP_TITLE,
} from '../../text/help.js';

const prevCustomId = (page: number): string => `help:prev:${page}`;
const nextCustomId = (page: number): string => `help:next:${page}`;

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

		const message: Message = await interaction.editReply({
			embeds: [helpEmbed(1)],
			components: total > 1 ? [pagerRow(1, total)] : [],
		});
		if (total <= 1) return;

		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button: ButtonInteraction) => button.user.id === interaction.user.id,
			time: HELP_PAGER_TTL_MS,
		});
		collector.on('collect', async (button: ButtonInteraction) => {
			try {
				const [, action, pageRaw] = button.customId.split(':');
				if (action === 'indicator' || pageRaw === undefined || Number.isNaN(Number(pageRaw))) return;
				const page = Math.min(Math.max(Number(pageRaw) + (action === 'next' ? 1 : -1), 1), total);
				await button.update({ embeds: [helpEmbed(page)], components: [pagerRow(page, total)] });
			} catch (error) {
				logger.error({ err: error, discordId: button.user.id }, 'help-page-failed');
				await button.reply({ content: HELP_FLOW_TEXT.failed, ephemeral: true }).catch(() => undefined);
			}
		});
		collector.on('end', async () => {
			// Hết giờ — gỡ nút, giữ nguyên embed đang hiển thị.
			await message.edit({ components: [] }).catch(() => undefined);
		});
	}
}
