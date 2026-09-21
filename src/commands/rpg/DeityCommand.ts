import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { AscensionService } from '../../services/AscensionService.js';
import { MAX_SIGILS } from '../../config/ascension.js';
import {
	DEITY_ALREADY_ASCENDED,
	DEITY_ASCEND_SUB_DESC,
	DEITY_ASCEND_SUCCESS,
	DEITY_DESCRIPTION,
	DEITY_INSUFFICIENT_ESSENCE,
	DEITY_INSUFFICIENT_RESOURCES,
	DEITY_NOT_ENOUGH_SIGILS,
	DEITY_NOT_OWNED,
	DEITY_SIGIL_MAXED,
	DEITY_SIGIL_SUB_DESC,
	DEITY_SIGIL_SUCCESS,
	DEITY_USER_DEITY_OPTION_DESC,
	DEITY_USER_DEITY_OPTION_DESC_SHORT,
} from '../../text/deity.js';

export class DeityCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('deity')
		.setDescription(DEITY_DESCRIPTION)
		.addSubcommand((sub) =>
			sub
				.setName('sigil')
				.setDescription(DEITY_SIGIL_SUB_DESC)
				.addIntegerOption((opt) =>
					opt.setName('user_deity_id').setDescription(DEITY_USER_DEITY_OPTION_DESC).setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('ascend')
				.setDescription(DEITY_ASCEND_SUB_DESC)
				.addIntegerOption((opt) =>
					opt.setName('user_deity_id').setDescription(DEITY_USER_DEITY_OPTION_DESC_SHORT).setRequired(true),
				),
		);

	constructor(private readonly ascension: Pick<AscensionService, 'addSigil' | 'ascend'> = new AscensionService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(true);
		const userDeityId = interaction.options.getInteger('user_deity_id', true);
		const discordId = interaction.user.id;

		if (sub === 'sigil') {
			const result = await this.ascension.addSigil(discordId, userDeityId);
			switch (result.status) {
				case 'not-owned':
					await interaction.editReply({ content: DEITY_NOT_OWNED });
					return;
				case 'maxed':
					await interaction.editReply({ content: DEITY_SIGIL_MAXED(MAX_SIGILS) });
					return;
				case 'insufficient-essence':
					await interaction.editReply({
						content: DEITY_INSUFFICIENT_ESSENCE(result.needed, result.have),
					});
					return;
				case 'ok':
					await interaction.editReply(DEITY_SIGIL_SUCCESS(result.newSigils, MAX_SIGILS));
					return;
			}
		} else {
			const result = await this.ascension.ascend(discordId, userDeityId);
			switch (result.status) {
				case 'not-owned':
					await interaction.editReply({ content: DEITY_NOT_OWNED });
					return;
				case 'already-ascended':
					await interaction.editReply({ content: DEITY_ALREADY_ASCENDED });
					return;
				case 'not-enough-sigils':
					await interaction.editReply({
						content: DEITY_NOT_ENOUGH_SIGILS(MAX_SIGILS, result.have),
					});
					return;
				case 'insufficient-resources':
					await interaction.editReply({
						content: DEITY_INSUFFICIENT_RESOURCES(
							result.neededEssence,
							result.neededCredux.toLocaleString(),
						),
					});
					return;
				case 'ok':
					await interaction.editReply(DEITY_ASCEND_SUCCESS);
					return;
			}
		}
	}
}
