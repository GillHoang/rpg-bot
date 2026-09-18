import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { AscensionService } from '../../services/AscensionService.js';
import { MAX_SIGILS } from '../../config/ascension.js';

export class DeityCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('deity')
		.setDescription('Quản lý Sigil và Ascension của deity')
		.addSubcommand((sub) =>
			sub
				.setName('sigil')
				.setDescription('Dùng essence để +1 Sigil cho deity')
				.addIntegerOption((opt) =>
					opt
						.setName('user_deity_id')
						.setDescription('ID deity sở hữu (xem trong /summon)')
						.setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('ascend')
				.setDescription('Ascend deity đã đủ 10/10 Sigil')
				.addIntegerOption((opt) =>
					opt.setName('user_deity_id').setDescription('ID deity sở hữu').setRequired(true),
				),
		);

	constructor(private readonly ascension = new AscensionService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(true);
		const userDeityId = interaction.options.getInteger('user_deity_id', true);
		const discordId = interaction.user.id;

		if (sub === 'sigil') {
			const result = this.ascension.addSigil(discordId, userDeityId);
			switch (result.status) {
				case 'not-owned':
					await interaction.editReply({ content: 'Bạn không sở hữu deity này.' });
					return;
				case 'maxed':
					await interaction.editReply({ content: `Deity đã đạt tối đa ${MAX_SIGILS}/${MAX_SIGILS} Sigil.` });
					return;
				case 'insufficient-essence':
					await interaction.editReply({
						content: `Không đủ essence. Cần ${result.needed}, hiện có ${result.have}.`,
					});
					return;
				case 'ok':
					await interaction.editReply(`✨ Đã +1 Sigil. Hiện tại: ${result.newSigils}/${MAX_SIGILS}.`);
					return;
			}
		} else {
			const result = this.ascension.ascend(discordId, userDeityId);
			switch (result.status) {
				case 'not-owned':
					await interaction.editReply({ content: 'Bạn không sở hữu deity này.' });
					return;
				case 'already-ascended':
					await interaction.editReply({ content: 'Deity này đã Ascend rồi.' });
					return;
				case 'not-enough-sigils':
					await interaction.editReply({
						content: `Cần đủ ${MAX_SIGILS}/${MAX_SIGILS} Sigil trước (hiện có ${result.have}).`,
					});
					return;
				case 'insufficient-resources':
					await interaction.editReply({
						content: `Không đủ tài nguyên. Cần ${result.neededEssence} essence + ${result.neededCredux.toLocaleString()} Credux.`,
					});
					return;
				case 'ok':
					await interaction.editReply(
						'🌟 **Ascension thành công!** Deity đạt 100% base stats, blessing được kích hoạt.',
					);
					return;
			}
		}
	}
}
