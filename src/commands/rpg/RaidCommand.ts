import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { sendBattleLog } from '../../render/BattleLogPager.js';
import { RaidService } from '../../services/RaidService.js';
import { NO_CHARACTER, NOT_REGISTERED } from '../../text/common.js';
import { RAID_FLOW_TEXT, RAID_DESCRIPTION, RAID_NO_MONSTERS_SEEDED } from '../../text/raid.js';
import { raidBattleOptions } from '../../render/raidBattleOptions.js';
import { GAMEPLAY_NOTICE } from '../../text/gameplay.js';
import { RAID_HUNT_COOLDOWN_SECONDS } from '../../config/raidLoot.js';

export class RaidCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('raid')
		.setDescription(RAID_DESCRIPTION)
		.addSubcommand((s) => s.setName('hunt').setDescription(RAID_FLOW_TEXT.huntDescription))
		.addSubcommand((s) => s.setName('boss').setDescription(RAID_FLOW_TEXT.bossDescription));

	constructor(private readonly raid: Pick<RaidService, 'run'> = new RaidService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Battle + reward grant can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const boss = interaction.options.getSubcommand(false) === 'boss';
		const result = await this.raid.run(interaction.user.id, boss);
		if (result.status === 'already-processed') {
			await interaction.editReply(RAID_FLOW_TEXT.alreadyProcessed);
			return;
		}
		if (result.status === 'boss-locked') {
			await interaction.editReply(result.message);
			return;
		}
		if (result.status === 'cooldown') {
			await interaction.editReply(
				GAMEPLAY_NOTICE.cooldown(Math.max(1, Math.ceil((result.retryAt.getTime() - Date.now()) / 1000))),
			);
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

		const options = raidBattleOptions(result, boss, interaction.user.username);
		if (!boss) {
			options.replay = {
				ownerId: interaction.user.id,
				cooldownMs: RAID_HUNT_COOLDOWN_SECONDS * 1000,
				run: async () => {
					const next = await this.raid.run(interaction.user.id, false);
					if (next.status === 'ok') return raidBattleOptions(next, false, interaction.user.username);
					if (next.status === 'cooldown')
						return GAMEPLAY_NOTICE.cooldown(
							Math.max(1, Math.ceil((next.retryAt.getTime() - Date.now()) / 1000)),
						);
					if (next.status === 'not-registered') return NOT_REGISTERED;
					if (next.status === 'no-character') return NO_CHARACTER;
					if (next.status === 'no-monsters-seeded') return RAID_NO_MONSTERS_SEEDED;
					if (next.status === 'boss-locked') return next.message;
					return RAID_FLOW_TEXT.alreadyProcessed;
				},
			};
		}
		await sendBattleLog(interaction, options, 'edit');
	}
}
