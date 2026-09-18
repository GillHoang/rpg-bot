import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { DailyService } from '../../services/DailyService.js';

export class DailyCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('daily').setDescription('Nhận phần thưởng điểm danh hàng ngày');

	constructor(private readonly daily = new DailyService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const result = await this.daily.claim(interaction.user.id);

		if (result.status === 'not-registered') {
			await interaction.editReply({ content: 'Bạn chưa đăng ký. Dùng `/register` trước đã.' });
			return;
		}
		if (result.status === 'already-claimed') {
			await interaction.editReply(
				`⏳ Bạn đã điểm danh hôm nay rồi (Day ${result.overall}). Quay lại sau nửa đêm giờ Manila.`,
			);
			return;
		}

		const milestoneLine = result.milestoneChestLabel ? `\n🎁 Milestone: +1 ${result.milestoneChestLabel}` : '';
		await interaction.editReply(
			`📅 **Daily Attendance — Day ${result.day}**\n` +
				`Month: ${result.monthly} / 30 · Streak: ${result.overall}\n\n` +
				`💰 +${result.credux.toLocaleString()} Credux\n` +
				`🔮 +${result.shards} Belief Shards\n` +
				`🎁 +1 ${result.chestLabel}${milestoneLine}`,
		);
	}
}
