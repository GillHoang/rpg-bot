import { REST, Routes } from 'discord.js';
import { CommandRegistry } from '../core/CommandRegistry.js';
import { registerAllCommands } from '../core/registerAllCommands.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Same single source of truth as the bot runtime — one list, two consumers.
registerAllCommands();
const registry = CommandRegistry.getInstance();

async function deploy(): Promise<void> {
	const body = registry.getAll().map((c) => c.data.toJSON());
	const rest = new REST().setToken(env.DISCORD_TOKEN);

	await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
	logger.info(`Deployed ${body.length} global slash command(s).`);
}

deploy().catch((error) => {
	logger.error({ err: error }, 'Failed to deploy commands');
	process.exit(1);
});
