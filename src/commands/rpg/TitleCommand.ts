import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CosmeticService } from '../../services/CosmeticService.js';

export class TitleCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('title')
		.setDescription('Quản lý titles')
		.addSubcommand((s) => s.setName('list').setDescription('Xem danh sách title và cách kiếm'))
		.addSubcommand((s) =>
			s
				.setName('equip')
				.setDescription('Đeo title (id 0 = tháo)')
				.addIntegerOption((o) => {
					o.setName('id').setDescription('Title ID từ /title list').setRequired(true).setMinValue(0);
					return o;
				}),
		);

	constructor(private readonly cosmetics = new CosmeticService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		if (interaction.options.getSubcommand(false) === 'equip') {
			await interaction.editReply(
				await this.cosmetics.equipTitle(interaction.user.id, interaction.options.getInteger('id', true)),
			);
			return;
		}
		await interaction.editReply(await this.cosmetics.listTitles(interaction.user.id));
	}
}
