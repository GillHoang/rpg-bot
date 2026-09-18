import { SlashCommandBuilder, AttachmentBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { ProfileService } from '../../services/ProfileService.js';
import { renderProfileCard } from '../../render/ProfileCardRenderer.js';

export class ProfileCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('profile').setDescription('Xem thẻ nhân vật của bạn');

	constructor(private readonly profile = new ProfileService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Canvas render + SQLite reads can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const result = await this.profile.get(interaction.user.id);
		if (result.status === 'not-registered') {
			await interaction.editReply({ content: 'Bạn chưa đăng ký. Dùng `/register` trước đã.' });
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply({ content: 'Bạn chưa tạo nhân vật. Dùng `/create` trước đã.' });
			return;
		}

		const png = renderProfileCard(result.data);
		const attachment = new AttachmentBuilder(png, { name: 'profile.png' });
		await interaction.editReply({ files: [attachment] });
	}
}
