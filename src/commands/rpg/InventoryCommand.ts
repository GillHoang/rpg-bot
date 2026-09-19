import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { InventoryRepository } from '../../repositories/InventoryRepository.js';
import {
	DEITIES_DESCRIPTION,
	DEITIES_EMPTY_PAGE,
	DEITIES_FOOTER,
	DEITIES_PAGE_OPTION_DESC,
	DEITIES_TITLE,
	INVENTORY_CATEGORY_OPTION_DESC,
	INVENTORY_DESCRIPTION,
	INVENTORY_EMPTY_PAGE,
	INVENTORY_FOOTER,
	INVENTORY_PAGE_OPTION_DESC,
	INVENTORY_TITLE,
} from '../../text/inventory.js';
import { bagSummary } from '../../text/inventory.js';
import { NOT_REGISTERED } from '../../text/common.js';

export class InventoryCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('inventory')
		.setDescription(INVENTORY_DESCRIPTION)
		.addStringOption((o) =>
			o
				.setName('category')
				.setDescription(INVENTORY_CATEGORY_OPTION_DESC)
				.addChoices(...['bag', 'weapons', 'armors', 'runes'].map((value) => ({ name: value, value }))),
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
		const category = i.options.getString('category') ?? 'bag';
		const page = i.options.getInteger('page') ?? 1;
		const lines = category === 'bag' ? [bagSummary(bag)] : await repo.list(i.user.id, category, page);
		await i.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(INVENTORY_TITLE(category, page))
					.setDescription(lines.join('\n\n').slice(0, 4000) || INVENTORY_EMPTY_PAGE)
					.setFooter({ text: INVENTORY_FOOTER }),
			],
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
