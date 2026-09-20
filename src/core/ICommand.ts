import type {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

/**
 * Command pattern: every slash command is a self-contained object that
 * knows both its own declaration (`data`) and its own behaviour
 * (`execute`). The dispatcher (CommandRegistry) never needs an if/else
 * chain over command names — it just looks the command up and calls it.
 */
export interface ICommand {
	readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
	/** Optional: answers option-autocomplete requests for this command. */
	autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}
