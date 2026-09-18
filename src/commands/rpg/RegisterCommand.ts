import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { RegistrationService } from '../../services/RegistrationService.js';

const LORE =
	'Welcome to Credd. Gods once kept the darkness at bay, fed by mortal belief — until the prayers ' +
	'stopped and the world fell. You are the Last Believer, and remembering a god is enough to pull it back.\n\n' +
	'Next: `/create` to choose your class.';

export class RegisterCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('register')
		.setDescription('Bắt đầu hành trình của bạn tại Credd');

	constructor(private readonly registration = new RegistrationService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const result = this.registration.register(interaction.user.id, interaction.user.username);

		if (result.status === 'already-registered') {
			await interaction.reply({
				content: 'Bạn đã đăng ký rồi. Dùng `/create` để bắt đầu hành trình.',
				ephemeral: true,
			});
			return;
		}

		await interaction.reply(LORE);
	}
}
