import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { GetBalanceUseCase } from '../application/GetBalanceUseCase.js';
import { BALANCE_DESCRIPTION, BALANCE_SUCCESS } from '../../../shared/ui/text/balance.js';
import { NO_CHARACTER } from '../../../shared/ui/text/common.js';
import { bagSummary } from '../../../shared/ui/text/inventory.js';

export class BalanceCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('balance').setDescription(BALANCE_DESCRIPTION);

	constructor(private readonly balance: Pick<GetBalanceUseCase, 'execute'>) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const result = await this.balance.execute({ discordId: interaction.user.id });
		if (!result.ok) throw result.error;
		if (!result.value) {
			await interaction.editReply({ content: NO_CHARACTER });
			return;
		}
		const { username, credux, bag } = result.value;
		await interaction.editReply(
			BALANCE_SUCCESS(username, credux) + (bag ? '\n' + bagSummary(bag) : ''),
		);
	}
}
