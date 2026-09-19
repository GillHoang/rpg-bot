import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { QuestService } from '../../services/QuestService.js';

export class QuestCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('quest')
		.setDescription('Quest hằng ngày và hằng tuần')
		.addSubcommand((s) => s.setName('view').setDescription('Xem quest hiện tại và tiến độ'))
		.addSubcommand((s) => s.setName('refresh').setDescription('Reroll daily quests (1 lần/ngày)'))
		.addSubcommand((s) => s.setName('claim').setDescription('Claim Weekly Grand khi đủ 3 weekly quest'));

	constructor(private readonly quests = new QuestService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(false);
		if (sub === 'refresh') {
			await interaction.editReply(await this.quests.refresh(interaction.user.id));
			return;
		}
		if (sub === 'claim') {
			await interaction.editReply(await this.quests.claimWeeklyGrand(interaction.user.id));
			return;
		}
		await interaction.editReply(await this.quests.view(interaction.user.id));
	}
}
