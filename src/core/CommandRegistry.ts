import type { ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from './ICommand.js';
import { logger } from '../utils/logger.js';
import { GENERIC_ERROR } from '../text/common.js';

/**
 * Singleton registry mapping command name -> ICommand instance.
 * Kept deliberately dumb: it does not know *how* commands work, only
 * that they satisfy ICommand. Adding a new command never means touching
 * this file's logic, only calling `.register()` once at bootstrap.
 */
export class CommandRegistry {
	private static instance: CommandRegistry | null = null;
	private readonly commands = new Map<string, ICommand>();

	private constructor() {}

	static getInstance(): CommandRegistry {
		if (!CommandRegistry.instance) {
			CommandRegistry.instance = new CommandRegistry();
		}
		return CommandRegistry.instance;
	}

	register(command: ICommand): void {
		const name = command.data.name;
		if (this.commands.has(name)) {
			throw new Error(`Duplicate command registration: "${name}"`);
		}
		this.commands.set(name, command);
	}

	getAll(): ICommand[] {
		return [...this.commands.values()];
	}

	async dispatch(interaction: ChatInputCommandInteraction): Promise<void> {
		const command = this.commands.get(interaction.commandName);
		if (!command) {
			logger.warn({ command: interaction.commandName }, 'Unknown command invoked');
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			logger.error({ err: error, command: interaction.commandName }, 'Command execution failed');
			// The fallback reply itself can throw (e.g. the interaction already
			// expired -> DiscordAPIError Unknown interaction); swallow it so a
			// failed command never escalates into an unhandled rejection that
			// kills the process.
			try {
				const payload = { content: GENERIC_ERROR, ephemeral: true };
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp(payload);
				} else {
					await interaction.reply(payload);
				}
			} catch (replyError) {
				logger.warn(
					{ err: replyError, command: interaction.commandName },
					'Failed to send error reply — interaction likely expired',
				);
			}
		}
	}
}
