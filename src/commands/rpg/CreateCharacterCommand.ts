import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CharacterCreationService } from '../../services/CharacterCreationService.js';
import { CLASSES, CLASS_NAMES } from '../../config/classes.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../../config/starter.js';
import type { CombatClass } from '../../domain/entities/PlayerAccount.js';
import {
	CREATE_ALREADY_HAS_CHARACTER,
	CREATE_CLASS_OPTION_DESC,
	CREATE_DESCRIPTION,
	CREATE_STARTER_GEAR_MISSING,
	CREATE_SUCCESS,
} from '../../text/create.js';
import { NOT_REGISTERED } from '../../text/common.js';

/**
 * Simplified UX vs the original create.js: that version shows a button
 * flow (class select -> preview card -> confirm). Here the class is a
 * slash-command option instead — same guarded transaction underneath,
 * no portrait canvas card yet (that's M2 scope).
 */
export class CreateCharacterCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('create')
		.setDescription(CREATE_DESCRIPTION)
		.addStringOption((opt) =>
			opt
				.setName('class')
				.setDescription(CREATE_CLASS_OPTION_DESC)
				.setRequired(true)
				.addChoices(...CLASS_NAMES.map((name) => ({ name, value: name }))),
		);

	constructor(private readonly creation = new CharacterCreationService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const combatClass = interaction.options.getString('class', true) as CombatClass;
		const result = await this.creation.createCharacter(interaction.user.id, combatClass);

		switch (result.status) {
			case 'not-registered':
				await interaction.reply({ content: NOT_REGISTERED, ephemeral: true });
				return;
			case 'already-has-character':
				await interaction.reply({ content: CREATE_ALREADY_HAS_CHARACTER, ephemeral: true });
				return;
			case 'starter-gear-missing':
				await interaction.reply({ content: CREATE_STARTER_GEAR_MISSING, ephemeral: true });
				return;
			case 'ok': {
				const cls = CLASSES[combatClass];
				await interaction.reply(
					CREATE_SUCCESS(
						cls.emoji,
						combatClass,
						cls.passiveName,
						GRANT_BELIEF_SHARDS.toLocaleString(),
						GRANT_SILVER_CHESTS,
					),
				);
			}
		}
	}
}
