import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { EnhancementService } from '../../services/EnhancementService.js';

export class EnhanceCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('enhance')
		.setDescription('Nâng cấp trang bị (+1 mỗi lần thử)')
		.addStringOption((opt) => opt.setName('gear_id').setDescription('ID vũ khí/giáp').setRequired(true));

	constructor(private readonly enhancement = new EnhancementService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const gearId = interaction.options.getString('gear_id', true);
		const result = this.enhancement.attempt(interaction.user.id, gearId);

		switch (result.status) {
			case 'not-found':
				await interaction.editReply({ content: 'Không tìm thấy trang bị này thuộc về bạn.' });
				return;
			case 'maxed-or-not-enhanceable':
				await interaction.editReply({ content: 'Trang bị đã đạt mức tối đa hoặc không thể nâng cấp.' });
				return;
			case 'insufficient-credux':
				await interaction.editReply({
					content: `Không đủ Credux. Cần ${result.needed.toLocaleString()}, hiện có ${result.have.toLocaleString()}.`,
				});
				return;
			case 'success':
				await interaction.editReply(
					`✅ **Thành công!** Trang bị lên +${result.newLevel - 1}. (-${result.cost.toLocaleString()} Credux)`,
				);
				return;
			case 'failure':
				await interaction.editReply(
					`❌ **Thất bại.** Trang bị giữ nguyên cấp độ. (-${result.cost.toLocaleString()} Credux)`,
				);
				return;
		}
	}
}
