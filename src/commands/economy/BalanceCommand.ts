import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { EconomyService } from '../../services/EconomyService.js';

export class BalanceCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('balance').setDescription('Xem số Credux hiện có của bạn');

	constructor(private readonly economy = new EconomyService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const account = await this.economy.getAccount(interaction.user.id);

		if (!account) {
			await interaction.reply({
				content: 'Bạn chưa tạo nhân vật. Dùng lệnh `/create` để bắt đầu.',
				ephemeral: true,
			});
			return;
		}

		await interaction.reply(`💰 **${account.username}** hiện có **${account.credux}** Credux.`);
	}
}
