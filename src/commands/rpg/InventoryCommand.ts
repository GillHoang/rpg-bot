import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { InventoryRepository } from '../../repositories/InventoryRepository.js';
import { bagSummary } from '../../text/inventory.js';
import { NOT_REGISTERED } from '../../text/common.js';

export class InventoryCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('Xem tài nguyên và ID vật phẩm')
		.addStringOption((o) =>
			o
				.setName('category')
				.setDescription('Loại vật phẩm')
				.addChoices(...['bag', 'weapons', 'armors', 'runes'].map((value) => ({ name: value, value }))),
		)
		.addIntegerOption((o) => o.setName('page').setDescription('Trang (8 vật phẩm/trang)').setMinValue(1));
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
					.setTitle(`Inventory · ${category} · Trang ${page}`)
					.setDescription(lines.join('\n\n').slice(0, 4000) || 'Trang trống.')
					.setFooter({ text: '/equip · /enhance · /socket · Đổi page để xem tiếp' }),
			],
		});
	}
}
export class DeitiesCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('deities')
		.setDescription('Xem ID, Sigil và chỉ số deity')
		.addIntegerOption((o) => o.setName('page').setDescription('Trang').setMinValue(1));
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const page = i.options.getInteger('page') ?? 1;
		const rows = await new InventoryRepository().list(i.user.id, 'deities', page);
		await i.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(`Deities · Trang ${page}`)
					.setDescription(rows.join('\n\n').slice(0, 4000) || 'Chưa có deity ở trang này. Dùng /summon.')
					.setFooter({ text: '/equip kind:deity · /deity sigil · /deity ascend (prestige)' }),
			],
		});
	}
}
