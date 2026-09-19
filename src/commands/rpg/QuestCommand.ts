import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { QuestService } from '../../services/QuestService.js';
import { QUEST_CLAIM_DESC, QUEST_DESCRIPTION, QUEST_REFRESH_DESC, QUEST_VIEW_DESC } from '../../text/quest.js';

export class QuestCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('quest')
		.setDescription(QUEST_DESCRIPTION)
		.addSubcommand((s) => s.setName('view').setDescription(QUEST_VIEW_DESC))
		.addSubcommand((s) => s.setName('refresh').setDescription(QUEST_REFRESH_DESC))
		.addSubcommand((s) => s.setName('claim').setDescription(QUEST_CLAIM_DESC));

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
