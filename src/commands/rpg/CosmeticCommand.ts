import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CosmeticService } from '../../services/CosmeticService.js';
import {
	COSMETIC_DESCRIPTION,
	COSMETIC_EQUIP_DESC,
	COSMETIC_ID_OPTION_DESC,
	COSMETIC_LIST_DESC,
} from '../../text/cosmetic.js';

export class CosmeticCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('cosmetic')
		.setDescription(COSMETIC_DESCRIPTION)
		.addSubcommand((s) => s.setName('list').setDescription(COSMETIC_LIST_DESC))
		.addSubcommand((s) =>
			s
				.setName('equip')
				.setDescription(COSMETIC_EQUIP_DESC)
				.addIntegerOption((o) =>
					o.setName('id').setDescription(COSMETIC_ID_OPTION_DESC).setRequired(true).setMinValue(1),
				),
		);

	constructor(
		private readonly cosmetics: Pick<CosmeticService, 'equipCosmetic' | 'listCosmetics'> = new CosmeticService(),
	) {}

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
