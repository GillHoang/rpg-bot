import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { RegistrationService } from '../../services/RegistrationService.js';
import { REGISTER_ALREADY, REGISTER_DESCRIPTION, REGISTER_LORE } from '../../text/register.js';

export class RegisterCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('register').setDescription(REGISTER_DESCRIPTION);

	constructor(private readonly registration = new RegistrationService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const result = await this.registration.register(interaction.user.id, interaction.user.username);

		if (result.status === 'already-registered') {
			await interaction.reply({ content: REGISTER_ALREADY, ephemeral: true });
			return;
		}

		await interaction.reply(REGISTER_LORE);
	}
}
