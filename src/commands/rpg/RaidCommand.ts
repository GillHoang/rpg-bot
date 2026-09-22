import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { sendBattleLog } from '../../render/BattleLogPager.js';
import { RaidService } from '../../services/RaidService.js';
import { NO_CHARACTER, NOT_REGISTERED } from '../../text/common.js';
import { RAID_DESCRIPTION, RAID_NO_MONSTERS_SEEDED } from '../../text/raid.js';
import { raidBattleOptions } from '../../render/raidBattleOptions.js';

export class RaidCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('raid')
		.setDescription(RAID_DESCRIPTION)
		.addSubcommand((s) => s.setName('hunt').setDescription('Săn mob thường hoặc elite (20%)'))
		.addSubcommand((s) =>
			s.setName('boss').setDescription('Bakunawa: cấp 10, phí 10.000 Credux, 1 lần/ngày (00:00 Manila)'),
		);

	constructor(private readonly raid: Pick<RaidService, 'run'> = new RaidService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Battle + reward grant can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const boss = interaction.options.getSubcommand(false) === 'boss';
		const result = await this.raid.run(interaction.user.id, boss);
		if (result.status === 'already-processed') {
			await interaction.editReply('Trận đấu này đã được xử lý.');
			return;
		}
		if (result.status === 'boss-locked') {
			await interaction.editReply(result.message);
			return;
		}

		if (result.status === 'not-registered') {
			await interaction.editReply({ content: NOT_REGISTERED });
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply({ content: NO_CHARACTER });
			return;
		}
		if (result.status === 'no-monsters-seeded') {
			await interaction.editReply({ content: RAID_NO_MONSTERS_SEEDED });
			return;
		}

		await sendBattleLog(interaction, raidBattleOptions(result, boss, interaction.user.username), 'edit');
	}
}
