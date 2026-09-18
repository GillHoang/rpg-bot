import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { SummonService } from '../../services/SummonService.js';
import { TIER_ALIAS, MAX_PULLS } from '../../config/gachaRates.js';

export class SummonCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('summon')
		.setDescription('Triệu hồi vị thần bằng Belief Shards')
		.addIntegerOption((opt) =>
			opt
				.setName('count')
				.setDescription(`Số lượt triệu hồi (1-${MAX_PULLS})`)
				.setMinValue(1)
				.setMaxValue(MAX_PULLS)
				.setRequired(true),
		);

	constructor(private readonly summon = new SummonService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Multi-pull transactions can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const count = interaction.options.getInteger('count', true);
		const result = await this.summon.run(interaction.user.id, count);

		switch (result.status) {
			case 'invalid-count':
				await interaction.editReply({ content: `Số lượt phải trong khoảng 1-${MAX_PULLS}.` });
				return;
			case 'no-character':
				await interaction.editReply({ content: 'Bạn chưa tạo nhân vật. Dùng `/create` trước đã.' });
				return;
			case 'insufficient-shards':
				await interaction.editReply({
					content: `Không đủ Belief Shards. Cần ${result.needed.toLocaleString()}, hiện có ${result.have.toLocaleString()}.`,
				});
				return;
			case 'no-deities-seeded':
				await interaction.editReply({
					content: `Chưa có deity nào seed cho tier ${result.tier} (deity_roster trống). Báo admin.`,
				});
				return;
			case 'ok': {
				const lines = result.pulls.map((p) => {
					const alias = TIER_ALIAS[p.tier];
					const suffix = p.isDupe ? ` (trùng — +${p.essenceGained} ${p.tier} Essence)` : ' ✨ MỚI';
					return `**[${p.tier} · ${alias}]** ${p.name} (${p.mythology})${suffix}`;
				});
				await interaction.editReply(
					`🔮 **Triệu hồi x${result.pulls.length}** — đã dùng ${result.shardsSpent.toLocaleString()} Belief Shards\n\n` +
						`${lines.join('\n')}\n\n` +
						`_Pity hiện tại: ${result.finalPity}/500_`,
				);
			}
		}
	}
}
