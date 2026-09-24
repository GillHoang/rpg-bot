import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { EconomyService } from '../application/EconomyService.js';
import { BALANCE_DESCRIPTION, BALANCE_SUCCESS } from '../../../shared/ui/text/balance.js';
import { NO_CHARACTER } from '../../../shared/ui/text/common.js';
import { InventoryService } from '../../progression/application/InventoryService.js';
import { bagSummary } from '../../../shared/ui/text/inventory.js';

export class BalanceCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('balance').setDescription(BALANCE_DESCRIPTION);

	constructor(
		private readonly economy: Pick<EconomyService, 'getAccount'> = new EconomyService(),
		private readonly inventory: Pick<InventoryService, 'bag'> = new InventoryService(),
	) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const account = await this.economy.getAccount(interaction.user.id);

		if (!account) {
			await interaction.editReply({ content: NO_CHARACTER });
			return;
		}

		const bag = await this.inventory.bag(interaction.user.id);
		await interaction.editReply(
			BALANCE_SUCCESS(account.username, account.credux) + (bag ? '\n' + bagSummary(bag) : ''),
		);
	}
}
