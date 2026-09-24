import { SlashCommandBuilder, AttachmentBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { ProfileService } from '../application/ProfileService.js';
import { renderProfileCard } from '../../../shared/ui/render/ProfileCardRenderer.js';
import { PROFILE_DESCRIPTION } from '../../../shared/ui/text/profile.js';
import { NOT_REGISTERED, NO_CHARACTER } from '../../../shared/ui/text/common.js';

export class ProfileCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('profile').setDescription(PROFILE_DESCRIPTION);

	constructor(private readonly profile: Pick<ProfileService, 'get'>) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Canvas render + SQLite reads can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const result = await this.profile.get(interaction.user.id);
		if (result.status === 'not-registered') {
			await interaction.editReply({ content: NOT_REGISTERED });
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply({ content: NO_CHARACTER });
			return;
		}

		const png = renderProfileCard(result.data);
		const attachment = new AttachmentBuilder(png, { name: 'profile.png' });
		await interaction.editReply({ files: [attachment] });
	}
}
