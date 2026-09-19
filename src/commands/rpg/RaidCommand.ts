import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { RaidService } from '../../services/RaidService.js';
import { NO_CHARACTER, NOT_REGISTERED } from '../../text/common.js';
import {
	RAID_DESCRIPTION,
	RAID_DRAW,
	RAID_LOSE,
	RAID_LOG_TRUNCATE_PREFIX,
	RAID_MAX_LOG_CHARS,
	RAID_NO_MONSTERS_SEEDED,
	RAID_REWARD_CREDUX,
	RAID_REWARD_EXP,
	RAID_REWARD_LEVEL_UP,
	RAID_REWARD_SHARDS,
	RAID_ROUND_SUMMARY,
	RAID_WIN,
} from '../../text/raid.js';

export class RaidCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('raid')
		.setDescription(RAID_DESCRIPTION)
		.addSubcommand((s) => s.setName('hunt').setDescription('Săn mob thường hoặc elite (20%)'))
		.addSubcommand((s) =>
			s.setName('boss').setDescription('Bakunawa: cấp 10, phí 10.000 Credux, 1 lần/ngày (00:00 Manila)'),
		);

	constructor(private readonly raid = new RaidService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Battle + reward grant can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const boss = interaction.options.getSubcommand(false) === 'boss';
		const result = await this.raid.run(interaction.user.id, boss);
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

		const { battle, monsterName, credux, shards, expGained, gotChest, progress } = result;
		let outcomeLine = RAID_DRAW;
		if (battle.outcome === 'player_win') outcomeLine = RAID_WIN(monsterName);
		else if (battle.outcome === 'enemy_win') outcomeLine = RAID_LOSE(monsterName);

		let logText = battle.log.join('\n');
		if (logText.length > RAID_MAX_LOG_CHARS)
			logText = RAID_LOG_TRUNCATE_PREFIX + logText.slice(-RAID_MAX_LOG_CHARS);

		const rewardLines = [
			RAID_REWARD_EXP(expGained.toLocaleString()),
			credux > 0 ? RAID_REWARD_CREDUX(credux.toLocaleString()) : null,
			shards > 0 ? RAID_REWARD_SHARDS(shards) : null,
			gotChest ? `📦 +1 ${result.chestName}` : null,
			result.gearDrop,
			boss ? 'Phí vào boss: -10.000 Credux (reset 00:00 Manila).' : null,
			progress.leveledUp ? RAID_REWARD_LEVEL_UP(progress.previousLevel, progress.newLevel) : null,
		].filter(Boolean);

		await interaction.editReply(
			`${outcomeLine}\n` +
				RAID_ROUND_SUMMARY(battle.rounds, battle.playerHpRemaining, battle.enemyHpRemaining) +
				logText +
				rewardLines.join('\n'),
		);
	}
}
