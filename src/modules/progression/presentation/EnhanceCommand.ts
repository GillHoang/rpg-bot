import { formatNumber } from '../../../shared/ui/text/format.js';
import { SlashCommandBuilder, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { EnhancementService } from '../application/EnhancementService.js';
import { InventoryService } from '../application/InventoryService.js';
import { GEAR_CHOICE_LABEL } from '../../../shared/ui/text/autocomplete.js';
import {
	ENHANCE_DESCRIPTION,
	ENHANCE_FAILURE,
	ENHANCE_GEAR_OPTION_DESC,
	ENHANCE_INSUFFICIENT_CREDUX,
	ENHANCE_MAXED,
	ENHANCE_NOT_FOUND,
	ENHANCE_SUCCESS,
} from '../../../shared/ui/text/enhance.js';

export class EnhanceCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('enhance')
		.setDescription(ENHANCE_DESCRIPTION)
		.addStringOption((opt) =>
			opt.setName('gear_id').setDescription(ENHANCE_GEAR_OPTION_DESC).setRequired(true).setAutocomplete(true),
		);

	constructor(
		private readonly enhancement: Pick<EnhancementService, 'attempt'>,
		private readonly inventory: Pick<InventoryService, 'searchWeapons' | 'searchArmors'>,
	) {}

	async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
		if (interaction.options.getFocused(true).name !== 'gear_id') return;
		const query = String(interaction.options.getFocused());
		const repo = this.inventory;
		const [weapons, armors] = await Promise.all([
			repo.searchWeapons(interaction.user.id, query),
			repo.searchArmors(interaction.user.id, query),
		]);
		// Xen kẽ vũ khí/giáp trong 25 slot — cả hai loại luôn xuất hiện.
		const rows: typeof weapons = [];
		for (let i = 0; rows.length < 25 && (i < weapons.length || i < armors.length); i++) {
			if (i < weapons.length) rows.push(weapons[i]!);
			if (i < armors.length && rows.length < 25) rows.push(armors[i]!);
		}
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
					content: ENHANCE_INSUFFICIENT_CREDUX(formatNumber(result.needed), formatNumber(result.have)),
				});
				return;
			case 'success':
				await interaction.editReply(ENHANCE_SUCCESS(result.newLevel - 1, formatNumber(result.cost)));
				return;
			case 'failure':
				await interaction.editReply(ENHANCE_FAILURE(formatNumber(result.cost)));
				return;
		}
	}
}
