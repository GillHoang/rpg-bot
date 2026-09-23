import { LOG_EVENT_TEXT, COMMAND_LOG_TEXT } from '../text/diagnostics.js';

import { COMMAND_RECOVERY_TEXT, GENERIC_ERROR } from '../text/common.js';
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from './ICommand.js';
import { logger } from '../utils/logger.js';

/**
 * Application registry mapping command name -> ICommand instance.
 * Kept deliberately dumb: it does not know *how* commands work, only
 * that they satisfy ICommand. Adding a new command never means touching
 * this file's logic, only calling `.register()` once at bootstrap.
 */
export class CommandRegistry {
	private static instance: CommandRegistry | null = null;
	private readonly commands = new Map<string, ICommand>();

	static getInstance(): CommandRegistry {
		CommandRegistry.instance ??= new CommandRegistry();
		return CommandRegistry.instance;
	}

	register(command: ICommand): void {
		const name = command.data.name;
		if (this.commands.has(name)) {
			throw new Error(COMMAND_LOG_TEXT.duplicate(name));
		}
		this.commands.set(name, command);
	}

	getAll(): ICommand[] {
		return [...this.commands.values()];
	}

	async dispatch(interaction: ChatInputCommandInteraction): Promise<void> {
		const command = this.commands.get(interaction.commandName);
		if (!command) {
			logger.warn({ command: interaction.commandName }, COMMAND_LOG_TEXT.unknownCommand);
			await interaction
				.reply({ content: COMMAND_RECOVERY_TEXT.unavailable, ephemeral: true })
				.catch((err: unknown) => logger.warn({ err }, COMMAND_LOG_TEXT.unknownReplyFailed));
			return;
		}

		// Audit: ai gọi lệnh gì, kèm tham số phụ (option không nhạy cảm).
		logger.info(
			{
				command: interaction.commandName,
				user: interaction.user.id,
				username: interaction.user.username,
				guild: interaction.guildId ?? 'dm',
				options: interaction.options.data.map((o) => ({ name: o.name, value: o.value })),
			},
			LOG_EVENT_TEXT.command,
		);

		try {
			await command.execute(interaction);
		} catch (error) {
			logger.error({ err: error, command: interaction.commandName }, COMMAND_LOG_TEXT.executionFailed);
			// The fallback reply itself can throw (e.g. the interaction already
			// expired -> DiscordAPIError Unknown interaction); swallow it so a
			// failed command never escalates into an unhandled rejection that
			// kills the process.
			try {
				const payload = { content: GENERIC_ERROR, ephemeral: true };
				if (interaction.deferred && !interaction.replied) {
					await interaction.editReply({ content: GENERIC_ERROR, components: [] });
				} else if (interaction.replied) {
					await interaction.followUp(payload);
				} else {
					await interaction.reply(payload);
				}
			} catch (replyError) {
				logger.warn({ err: replyError, command: interaction.commandName }, COMMAND_LOG_TEXT.errorReplyFailed);
			}
		}
	}

	/** Autocomplete must always be answered (empty on failure) or Discord keeps the option stuck. */
	async dispatchAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
		const command = this.commands.get(interaction.commandName);
		if (!command?.autocomplete) {
			await interaction.respond([]).catch(() => undefined);
			return;
		}
		try {
			await command.autocomplete(interaction);
		} catch (error) {
			logger.error({ err: error, command: interaction.commandName }, COMMAND_LOG_TEXT.autocompleteFailed);
			await interaction.respond([]).catch(() => undefined);
		}
	}
}
