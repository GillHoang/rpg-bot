import { dailyRewardText } from '../../../shared/ui/render/dailyRewardText.js';
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { ClaimDailyUseCase } from '../application/ClaimDailyUseCase.js';
import { DAILY_ALREADY_CLAIMED, DAILY_DESCRIPTION } from '../../../shared/ui/text/daily.js';
import { NOT_REGISTERED } from '../../../shared/ui/text/common.js';

export class DailyCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('daily').setDescription(DAILY_DESCRIPTION);

	constructor(private readonly daily: Pick<ClaimDailyUseCase, 'claim'> = new ClaimDailyUseCase()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const result = await this.daily.claim(interaction.user.id);

		if (result.status === 'not-registered') {
			await interaction.editReply({ content: NOT_REGISTERED });
			return;
		}
		if (result.status === 'already-claimed') {
			await interaction.editReply(DAILY_ALREADY_CLAIMED(result.overall));
			return;
		}

		await interaction.editReply(dailyRewardText(result));
	}
}
