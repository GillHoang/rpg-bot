import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { QuestService } from '../application/QuestService.js';
import {
	QUEST_CLAIM_DESC,
	QUEST_DESCRIPTION,
	QUEST_REFRESH_DESC,
	QUEST_VIEW_DESC,
} from '../../../shared/ui/text/quest.js';

export class QuestCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('quest')
		.setDescription(QUEST_DESCRIPTION)
		.addSubcommand((s) => s.setName('view').setDescription(QUEST_VIEW_DESC))
		.addSubcommand((s) => s.setName('refresh').setDescription(QUEST_REFRESH_DESC))
		.addSubcommand((s) => s.setName('claim').setDescription(QUEST_CLAIM_DESC));

	constructor(private readonly quests: Pick<QuestService, 'refresh' | 'claimWeeklyGrand' | 'view'>) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(false);
		if (sub === 'refresh') {
			const refreshed = await this.quests.refresh(interaction.user.id);
			await interaction.editReply(refreshed.ok ? refreshed.value : refreshed.error.message);
			return;
		}
		if (sub === 'claim') {
			const claimed = await this.quests.claimWeeklyGrand(interaction.user.id);
			await interaction.editReply(claimed.ok ? claimed.value : claimed.error.message);
			return;
		}
		const viewed = await this.quests.view(interaction.user.id);
		await interaction.editReply(viewed.ok ? viewed.value : viewed.error.message);
	}
}
