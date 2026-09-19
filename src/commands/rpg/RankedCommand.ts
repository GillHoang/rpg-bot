import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { RankedService } from '../../services/RankedService.js';

export class RankedCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('ranked')
		.setDescription('Ranked PvP: đấu async với loadout của đối thủ ngẫu nhiên cùng tầm rating')
		.addSubcommand((s) => s.setName('fight').setDescription('Tìm đối thủ và đấu 1 trận (Elo)'))
		.addSubcommand((s) =>
			s.setName('claim').setDescription('Nhận thưởng tuần theo bracket (cần ≥1 trận trong tuần)'),
		)
		.addSubcommand((s) => s.setName('stats').setDescription('Xem rating, bracket, peak và trạng thái thưởng tuần'));

	constructor(private readonly ranked = new RankedService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(false);

		if (sub === 'claim') {
			const result = await this.ranked.claim(interaction.user.id);
			const message =
				result.status === 'not-registered'
					? 'Dùng /register trước.'
					: result.status === 'already-claimed'
						? 'Đã nhận thưởng tuần này rồi. Reset vào thứ Hai (Asia/Manila).'
						: result.status === 'no-fights'
							? 'Chưa có trận ranked nào trong tuần này.'
							: result.status === 'no-reward-row'
								? 'Chưa seed bảng ranked_reward — báo admin chạy db:seed.'
								: `🏅 Weekly reward (${result.bracket}): +${result.credux.toLocaleString()} Credux · +${result.valor} Valor Medals` +
									(result.chests.length ? ` · ${result.chests.join(' · ')}` : '');
			await interaction.editReply(message);
			return;
		}

		if (sub === 'stats') {
			await interaction.editReply(await this.ranked.stats(interaction.user.id));
			return;
		}

		const result = await this.ranked.fight(interaction.user.id);
		if (result.status === 'not-registered') {
			await interaction.editReply('Dùng /register trước.');
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply('Dùng /create trước.');
			return;
		}
		if (result.status === 'busy') {
			await interaction.editReply('Bạn đang có một trận ranked khác. Chờ giây lát rồi thử lại.');
			return;
		}
		if (result.status === 'no-opponent') {
			await interaction.editReply('Không tìm thấy đối thủ nào đã đăng ký. Mời thêm người chơi vào server!');
			return;
		}

		const outcome = result.draw ? '⚖️ Hòa.' : result.won ? '🏆 **Thắng!**' : '💀 **Thua.**';
		const shieldNote = result.shieldUsed ? '\n🛡️ Demotion shield đã cứu bạn khỏi rớt bracket (đỡ 1 lần).' : '';
		let logText = result.battle.log.join('\n');
		if (logText.length > 900) logText = '…' + logText.slice(-900);
		await interaction.editReply(
			`${outcome} vs **${result.opponentName}**\n` +
				`Rating: **${result.ratingBefore} → ${result.ratingAfter}** (${result.delta >= 0 ? '+' : ''}${result.delta}) · ` +
				`Bracket: ${result.bracketBefore} → **${result.bracketAfter}** · Peak ${result.peak}` +
				shieldNote +
				`\n\`\`\`\n${logText}\n\`\`\`\n` +
				`/ranked claim để nhận thưởng tuần · /ranked stats để xem tổng quan.`,
		);
	}
}
