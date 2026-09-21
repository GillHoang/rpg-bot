import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { DailyService } from '../../services/DailyService.js';
import { DAILY_ALREADY_CLAIMED, DAILY_DESCRIPTION, DAILY_MILESTONE_LINE, DAILY_SUCCESS } from '../../text/daily.js';
import { NOT_REGISTERED } from '../../text/common.js';

export class DailyCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('daily').setDescription(DAILY_DESCRIPTION);

	constructor(private readonly daily: Pick<DailyService, 'claim'> = new DailyService()) {}

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

		const milestoneLine = result.milestoneChestLabel ? DAILY_MILESTONE_LINE(result.milestoneChestLabel) : '';
		await interaction.editReply(
			DAILY_SUCCESS(
				result.day,
				result.monthly,
				result.overall,
				result.credux.toLocaleString(),
				result.shards,
				result.chestLabel,
				milestoneLine,
			),
		);
	}
}
