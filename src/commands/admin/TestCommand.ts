import { ICommand } from '../../core/ICommand.js';
import { renderProgressBar } from '../../utils/progressBar.js';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export class TestCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('test').setDescription("sdsd");

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.reply({ content: renderProgressBar({ current: 10, max: 10, cells: 5 }) });
	}
}
