import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CosmeticService } from '../../services/CosmeticService.js';
import { TITLE_DESCRIPTION, TITLE_EQUIP_DESC, TITLE_ID_OPTION_DESC, TITLE_LIST_DESC } from '../../text/cosmetic.js';

export class TitleCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('title')
		.setDescription(TITLE_DESCRIPTION)
		.addSubcommand((s) => s.setName('list').setDescription(TITLE_LIST_DESC))
		.addSubcommand((s) =>
			s
				.setName('equip')
				.setDescription(TITLE_EQUIP_DESC)
				.addIntegerOption((o) =>
					o.setName('id').setDescription(TITLE_ID_OPTION_DESC).setRequired(true).setMinValue(0),
				),
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
