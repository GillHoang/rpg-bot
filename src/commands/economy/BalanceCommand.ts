import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { EconomyService } from '../../services/EconomyService.js';
import { BALANCE_DESCRIPTION, BALANCE_SUCCESS } from '../../text/balance.js';
import { NO_CHARACTER } from '../../text/common.js';
import { InventoryRepository } from '../../repositories/InventoryRepository.js';
import { bagSummary } from '../../text/inventory.js';

export class BalanceCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('balance').setDescription(BALANCE_DESCRIPTION);

	constructor(private readonly economy = new EconomyService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const account = await this.economy.getAccount(interaction.user.id);

		if (!account) {
			await interaction.editReply({ content: NO_CHARACTER });
			return;
		}

		const bag = await new InventoryRepository().bag(interaction.user.id);
		await interaction.editReply(
			BALANCE_SUCCESS(account.username, account.credux) + (bag ? '\n' + bagSummary(bag) : ''),
		);
	}
}
