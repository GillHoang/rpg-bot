import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CosmeticService } from '../../services/CosmeticService.js';

export class CosmeticCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('cosmetic')
		.setDescription('Quản lý cosmetics')
		.addSubcommand((s) => s.setName('list').setDescription('Xem catalog và item đang sở hữu'))
		.addSubcommand((s) =>
			s
				.setName('equip')
				.setDescription('Trang bị cosmetic')
				.addIntegerOption((o) => {
					o.setName('id').setDescription('Cosmetic ID từ /cosmetic list').setRequired(true).setMinValue(1);
					return o;
				}),
		);

	constructor(private readonly cosmetics = new CosmeticService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		if (interaction.options.getSubcommand(false) === 'equip') {
			await interaction.editReply(
				await this.cosmetics.equipCosmetic(interaction.user.id, interaction.options.getInteger('id', true)),
			);
			return;
		}
		await interaction.editReply(await this.cosmetics.listCosmetics(interaction.user.id));
	}
}
