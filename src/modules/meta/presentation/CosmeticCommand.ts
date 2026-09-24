import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { CosmeticService } from '../application/CosmeticService.js';
import {
	COSMETIC_DESCRIPTION,
	COSMETIC_EQUIP_DESC,
	COSMETIC_ID_OPTION_DESC,
	COSMETIC_LIST_DESC,
} from '../../../shared/ui/text/cosmetic.js';

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
		private readonly cosmetics: Pick<CosmeticService, 'equipCosmetic' | 'listCosmetics'>,
	) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		if (interaction.options.getSubcommand(false) === 'equip') {
			const equipped = await this.cosmetics.equipCosmetic(
				interaction.user.id,
				interaction.options.getInteger('id', true),
			);
			await interaction.editReply(equipped.ok ? equipped.value : equipped.error.message);
			return;
		}
		const listed = await this.cosmetics.listCosmetics(interaction.user.id);
		await interaction.editReply(listed.ok ? listed.value : listed.error.message);
	}
}
