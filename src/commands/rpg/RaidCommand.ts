import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { RaidService } from '../../services/RaidService.js';

const MAX_LOG_CHARS = 1200;

export class RaidCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('raid').setDescription('Chiến đấu với một quái vật ngẫu nhiên');

	constructor(private readonly raid = new RaidService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Battle + reward grant can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const result = await this.raid.run(interaction.user.id);

		if (result.status === 'not-registered') {
			await interaction.editReply({ content: 'Bạn chưa đăng ký. Dùng `/register` trước đã.' });
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply({ content: 'Bạn chưa tạo nhân vật. Dùng `/create` trước đã.' });
			return;
		}
		if (result.status === 'no-monsters-seeded') {
			await interaction.editReply({
				content: 'Chưa có dữ liệu quái vật (mob_roster trống). Báo admin seed dữ liệu.',
			});
			return;
		}

		const { battle, monsterName, credux, shards, expGained, gotChest, progress } = result;
		const outcomeLine =
			battle.outcome === 'player_win'
				? `🏆 **Chiến thắng!** Bạn đã hạ gục ${monsterName}.`
				: battle.outcome === 'enemy_win'
					? `💀 **Thất bại.** ${monsterName} đã đánh bại bạn.`
					: `⚖️ **Hòa.** Cả hai đều gục ngã.`;

		let logText = battle.log.join('\n');
		if (logText.length > MAX_LOG_CHARS) logText = `…\n${logText.slice(-MAX_LOG_CHARS)}`;

		const rewardLines = [
			`✨ +${expGained.toLocaleString()} EXP`,
			credux > 0 ? `🪙 +${credux.toLocaleString()} Credux` : null,
			shards > 0 ? `🔮 +${shards} Belief Shards` : null,
			gotChest ? `🎁 +1 Silver Chest` : null,
			progress.leveledUp ? `⬆️ **Lên cấp ${progress.previousLevel} → ${progress.newLevel}!**` : null,
		].filter(Boolean);

		await interaction.editReply(
			`${outcomeLine}\n` +
				`Số vòng: ${battle.rounds} · HP còn lại — Bạn: ${battle.playerHpRemaining} / Quái: ${battle.enemyHpRemaining}\n\n` +
				`\`\`\`\n${logText}\n\`\`\`\n` +
				rewardLines.join('\n'),
		);
	}
}
