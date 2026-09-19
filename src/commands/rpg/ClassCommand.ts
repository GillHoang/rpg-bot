import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { ClassChangeService } from '../../services/ClassChangeService.js';
import { CLASS_NAMES } from '../../config/classes.js';
import { CLASS_CHANGE_DESC, CLASS_DESCRIPTION, CLASS_NEW_CLASS_OPTION_DESC } from '../../text/class.js';
import type { CombatClass } from '../../domain/entities/PlayerAccount.js';

export class ClassCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('class')
		.setDescription(CLASS_DESCRIPTION)
		.addSubcommand((s) =>
			s
				.setName('change')
				.setDescription(CLASS_CHANGE_DESC)
				.addStringOption((opt) =>
					opt
						.setName('new_class')
						.setDescription(CLASS_NEW_CLASS_OPTION_DESC)
						.setRequired(true)
						.addChoices(...CLASS_NAMES.map((name) => ({ name, value: name }))),
				),
		);

	constructor(private readonly classChange = new ClassChangeService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const newClass = interaction.options.getString('new_class', true) as CombatClass;
		await interaction.editReply(await this.classChange.change(interaction.user.id, newClass));
	}
}
