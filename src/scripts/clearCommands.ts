import { CLEAR_COMMANDS_LOG_TEXT } from '../shared/ui/text/diagnostics.js';
import { REST, Routes } from 'discord.js';
import { env } from '../shared/config/env.js';
import { logger, flushErrorWebhook } from '../shared/utils/logger.js';
import { parseCommandScope } from './commandScope.js';

/** Clear only the selected scope. --all clears global plus the specified/default guild. */
try {
	const scope = parseCommandScope(process.argv.slice(2), env.DEPLOY_GUILD_ID, true);
	const rest = new REST().setToken(env.DISCORD_TOKEN);
	if (scope.global) {
		await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: [] });
		logger.info(CLEAR_COMMANDS_LOG_TEXT.globalCleared);
	}
	if (scope.guildId) {
		await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, scope.guildId), { body: [] });
		logger.info({ guildId: scope.guildId }, CLEAR_COMMANDS_LOG_TEXT.guildCleared);
	}
} catch (error) {
	logger.error({ err: error }, CLEAR_COMMANDS_LOG_TEXT.failed);
	await flushErrorWebhook();
	process.exit(1);
}
