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
import { InventoryRepository } from '../../repositories/InventoryRepository.js';
import {
	bagSummary,
	DEITIES_DESCRIPTION,
	DEITIES_EMPTY_PAGE,
	DEITIES_FOOTER,
	DEITIES_PAGE_OPTION_DESC,
	DEITIES_TITLE,
	INVENTORY_CATEGORY_LABELS,
	INVENTORY_CATEGORY_OPTION_DESC,
	INVENTORY_DESCRIPTION,
	INVENTORY_EMPTY_PAGE,
	INVENTORY_FOOTER,
	INVENTORY_NEXT_LABEL,
	INVENTORY_PAGE_INDICATOR,
	INVENTORY_PAGE_OPTION_DESC,
	INVENTORY_PAGER_TTL_MS,
	INVENTORY_PREV_LABEL,
	INVENTORY_TITLE,
} from '../../text/inventory.js';
import { GENERIC_ERROR, NOT_REGISTERED } from '../../text/common.js';
import { logger } from '../../utils/logger.js';

const PAGE_SIZE = 8; // khớp limit/offset trong InventoryRepository.list
const CATEGORIES = ['bag', 'weapons', 'armors', 'runes'] as const;

/**
 * Hai prefix RỜI nhau cho nút loại và nút trang. Dùng chung một scheme
 * `inventory:<category>:<page>` thì nút "Rune" (inventory:runes:1) trùng
 * custom_id với nút "Trước" khi đang ở trang 2 (inventory:runes:2-1) —
 * Discord từ chối cả message (COMPONENT_CUSTOM_ID_DUPLICATED).
 */
const CATEGORY_PREFIX = 'inventory:cat:';
const PAGE_PREFIX = 'inventory:page:';
const categoryCustomId = (category: string): string => `${CATEGORY_PREFIX}${category}`;
const pageCustomId = (category: string, page: number): string => `${PAGE_PREFIX}${category}:${page}`;

interface InventoryView {
	embed: EmbedBuilder;
	rows: ActionRowBuilder<ButtonBuilder>[];
	total: number;
	page: number;
	category: string;
}

async function buildView(
	repo: InventoryRepository,
	userId: string,
	category: string,
	requestedPage: number,
): Promise<InventoryView> {
	const total = category === 'bag' ? 1 : Math.max(1, Math.ceil((await repo.count(userId, category)) / PAGE_SIZE));
	const page = Math.min(Math.max(requestedPage, 1), total);
	const lines =
		category === 'bag' ? [bagSummary((await repo.bag(userId))!)] : await repo.list(userId, category, page);

	const embed = new EmbedBuilder()
		.setTitle(INVENTORY_TITLE(category, page))
		.setDescription(lines.join('\n\n').slice(0, 4000) || INVENTORY_EMPTY_PAGE)
		.setFooter({ text: INVENTORY_FOOTER });

	const rows = [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			CATEGORIES.map((c) =>
				new ButtonBuilder()
					.setCustomId(categoryCustomId(c))
					.setLabel(INVENTORY_CATEGORY_LABELS[c] ?? c)
					.setStyle(c === category ? ButtonStyle.Primary : ButtonStyle.Secondary),
			),
		),
	];
	if (total > 1) {
		rows.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(pageCustomId(category, page - 1))
					.setLabel(INVENTORY_PREV_LABEL)
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page <= 1),
				new ButtonBuilder()
					.setCustomId('inventory:indicator')
					.setLabel(INVENTORY_PAGE_INDICATOR(page, total))
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId(pageCustomId(category, page + 1))
					.setLabel(INVENTORY_NEXT_LABEL)
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= total),
			),
		);
	}
	return { embed, rows, total, page, category };
}

export class InventoryCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('inventory')
		.setDescription(INVENTORY_DESCRIPTION)
		.addStringOption((o) =>
			o
				.setName('category')
				.setDescription(INVENTORY_CATEGORY_OPTION_DESC)
				.addChoices(...CATEGORIES.map((value) => ({ name: value, value }))),
		)
		.addIntegerOption((o) => o.setName('page').setDescription(INVENTORY_PAGE_OPTION_DESC).setMinValue(1));

	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const repo = new InventoryRepository();
		const bag = await repo.bag(i.user.id);
		if (!bag) {
			await i.editReply(NOT_REGISTERED);
			return;
		}
		const view = await buildView(
			repo,
			i.user.id,
			i.options.getString('category') ?? 'bag',
			i.options.getInteger('page') ?? 1,
		);
		const message: Message = await i.editReply({ embeds: [view.embed], components: view.rows });

		// Chỉ chủ nhân kho được bấm (reply là ephemeral nên thực tế luôn đúng).
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button: ButtonInteraction) => button.user.id === i.user.id,
			time: INVENTORY_PAGER_TTL_MS,
		});
		collector.on('collect', async (button: ButtonInteraction) => {
			try {
				if (button.customId.startsWith(CATEGORY_PREFIX)) {
					const category = button.customId.slice(CATEGORY_PREFIX.length);
					if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) return;
					const next = await buildView(repo, i.user.id, category, 1);
					await button.update({ embeds: [next.embed], components: next.rows });
					return;
				}
				if (button.customId.startsWith(PAGE_PREFIX)) {
					const [, category, pageRaw] = button.customId.split(':');
					if (!category || pageRaw === undefined || Number.isNaN(Number(pageRaw))) return;
					const next = await buildView(repo, i.user.id, category, Number(pageRaw));
					await button.update({ embeds: [next.embed], components: next.rows });
					return;
				}
				// indicator (disabled) hoặc custom_id lạ — bỏ qua.
			} catch (error) {
				// Không để lỗi render/update thành unhandled rejection chết process.
				logger.error(
					{ err: error, discordId: button.user.id, customId: button.customId },
					'inventory-page-failed',
				);
				await button.reply({ content: GENERIC_ERROR, ephemeral: true }).catch(() => undefined);
			}
		});
		collector.on('end', async () => {
			// Hết giờ — gỡ nút, giữ nguyên embed đang hiển thị.
			await message.edit({ components: [] }).catch(() => undefined);
		});
	}
}

export class DeitiesCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('deities')
		.setDescription(DEITIES_DESCRIPTION)
		.addIntegerOption((o) => o.setName('page').setDescription(DEITIES_PAGE_OPTION_DESC).setMinValue(1));
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const page = i.options.getInteger('page') ?? 1;
		const rows = await new InventoryRepository().list(i.user.id, 'deities', page);
		await i.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(DEITIES_TITLE(page))
					.setDescription(rows.join('\n\n').slice(0, 4000) || DEITIES_EMPTY_PAGE)
					.setFooter({ text: DEITIES_FOOTER }),
			],
		});
	}
}
