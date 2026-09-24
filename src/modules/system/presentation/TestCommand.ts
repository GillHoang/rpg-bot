import { TEST_DESCRIPTION } from '../../../shared/ui/text/test.js';
import { ICommand } from '../../../shared/discord/command.js';
import { renderProgressBar } from '../../../shared/utils/progressBar.js';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export class TestCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('test').setDescription(TEST_DESCRIPTION);

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.reply({ content: renderProgressBar({ current: 10, max: 10, cells: 5 }) });
	}
}
