import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { logger, flushErrorWebhook } from '../utils/logger.js';
import { parseCommandScope } from './commandScope.js';

/** Clear only the selected scope. --all clears global plus the specified/default guild. */
try {
	const scope = parseCommandScope(process.argv.slice(2), env.DEPLOY_GUILD_ID, true);
	const rest = new REST().setToken(env.DISCORD_TOKEN);
	if (scope.global) {
		await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: [] });
		logger.info('Global slash commands cleared.');
	}
	if (scope.guildId) {
		await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, scope.guildId), { body: [] });
		logger.info({ guildId: scope.guildId }, 'Guild slash commands cleared.');
	}
} catch (error) {
	logger.error({ err: error }, 'Failed to clear slash commands');
	await flushErrorWebhook();
	process.exit(1);
}
