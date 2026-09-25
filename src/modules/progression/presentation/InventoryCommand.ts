import { LOG_EVENT_TEXT } from '../../../shared/ui/text/diagnostics.js';
import {
	ComponentType,
	EmbedBuilder,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Message,
} from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { InventoryService } from '../application/InventoryService.js';
import {
	DEITIES_DESCRIPTION,
	DEITIES_EMPTY_PAGE,
	DEITIES_FOOTER,
	DEITIES_PAGE_OPTION_DESC,
	DEITIES_TITLE,
	INVENTORY_CATEGORY_OPTION_DESC,
	INVENTORY_DESCRIPTION,
	INVENTORY_PAGE_OPTION_DESC,
	INVENTORY_PAGER_TTL_MS,
} from '../../../shared/ui/text/inventory.js';
import { GENERIC_ERROR, NOT_REGISTERED } from '../../../shared/ui/text/common.js';
import { logger } from '../../../shared/utils/logger.js';
import {
	buildInventoryView,
	INVENTORY_CATEGORIES,
	isInventoryCategory,
	parseInventoryAction,
} from '../../../shared/ui/render/InventoryPager.js';

export class InventoryCommand implements ICommand {
	constructor(private readonly inventory: Pick<InventoryService, 'bag' | 'count' | 'list'>) {}

	readonly data = new SlashCommandBuilder()
		.setName('inventory')
		.setDescription(INVENTORY_DESCRIPTION)
		.addStringOption((o) =>
			o
				.setName('category')
				.setDescription(INVENTORY_CATEGORY_OPTION_DESC)
				.addChoices(...INVENTORY_CATEGORIES.map((value) => ({ name: value, value }))),
		)
		.addIntegerOption((o) => o.setName('page').setDescription(INVENTORY_PAGE_OPTION_DESC).setMinValue(1));

	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const repo = this.inventory;
		const bag = await repo.bag(i.user.id);
		if (!bag) {
			await i.editReply(NOT_REGISTERED);
			return;
		}
		const category = i.options.getString('category');
		const view = await buildInventoryView(
			repo,
			i.user.id,
			isInventoryCategory(category) ? category : 'bag',
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
				const action = parseInventoryAction(button.customId);
				if (!action) return;
				const next = await buildInventoryView(repo, i.user.id, action.category, action.page);
				await button.update({ embeds: [next.embed], components: next.rows });
			} catch (error) {
				// Không để lỗi render/update thành unhandled rejection chết process.
				logger.error(
					{ err: error, discordId: button.user.id, customId: button.customId },
					LOG_EVENT_TEXT.inventoryPageFailed,
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
	constructor(private readonly inventory: Pick<InventoryService, 'list'>) {}

	readonly data = new SlashCommandBuilder()
		.setName('deities')
		.setDescription(DEITIES_DESCRIPTION)
		.addIntegerOption((o) => o.setName('page').setDescription(DEITIES_PAGE_OPTION_DESC).setMinValue(1));
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const page = i.options.getInteger('page') ?? 1;
		const rows = await this.inventory.list(i.user.id, 'deities', page);
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
