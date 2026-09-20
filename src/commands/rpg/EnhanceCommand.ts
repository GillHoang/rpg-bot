import { SlashCommandBuilder, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { EnhancementService } from '../../services/EnhancementService.js';
import { InventoryRepository } from '../../repositories/InventoryRepository.js';
import { GEAR_CHOICE_LABEL } from '../../text/autocomplete.js';
import {
	ENHANCE_DESCRIPTION,
	ENHANCE_FAILURE,
	ENHANCE_GEAR_OPTION_DESC,
	ENHANCE_INSUFFICIENT_CREDUX,
	ENHANCE_MAXED,
	ENHANCE_NOT_FOUND,
	ENHANCE_SUCCESS,
} from '../../text/enhance.js';

export class EnhanceCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('enhance')
		.setDescription(ENHANCE_DESCRIPTION)
		.addStringOption((opt) => opt.setName('gear_id').setDescription(ENHANCE_GEAR_OPTION_DESC).setRequired(true));

	constructor(private readonly enhancement = new EnhancementService()) {}

	async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
		if (interaction.options.getFocused(true).name !== 'gear_id') return;
		const rows = await new InventoryRepository().searchGear(
			interaction.user.id,
			String(interaction.options.getFocused()),
		);
		await interaction.respond(rows.map((g) => ({ name: GEAR_CHOICE_LABEL(g), value: g.id })));
	}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const gearId = interaction.options.getString('gear_id', true);
		const result = await this.enhancement.attempt(interaction.user.id, gearId);

		switch (result.status) {
			case 'not-found':
				await interaction.editReply({ content: ENHANCE_NOT_FOUND });
				return;
			case 'maxed-or-not-enhanceable':
				await interaction.editReply({ content: ENHANCE_MAXED });
				return;
			case 'insufficient-credux':
				await interaction.editReply({
					content: ENHANCE_INSUFFICIENT_CREDUX(result.needed.toLocaleString(), result.have.toLocaleString()),
				});
				return;
			case 'success':
				await interaction.editReply(ENHANCE_SUCCESS(result.newLevel - 1, result.cost.toLocaleString()));
				return;
			case 'failure':
				await interaction.editReply(ENHANCE_FAILURE(result.cost.toLocaleString()));
				return;
		}
	}
}
