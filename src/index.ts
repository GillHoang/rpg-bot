import { DiscordBot } from './core/DiscordBot.js';
import { registerAllCommands } from './core/registerAllCommands.js';
import { subscribeDomainEvents } from './core/subscribeDomainEvents.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
	// A stray rejection (e.g. a DiscordAPIError escaping an event handler)
	// must log, not take the bot down with Node's default behavior.
	process.on('unhandledRejection', (reason) => {
		logger.error({ err: reason }, 'Unhandled promise rejection');
	});
	process.on('uncaughtException', (err) => {
		logger.fatal({ err }, 'Uncaught exception — exiting');
		process.exit(1);
	});

	registerAllCommands();
	// Quest progress + believer EXP are pure EventBus subscribers — wire once.
	subscribeDomainEvents();
	const bot = new DiscordBot();
	await bot.start();
}

main().catch((error) => {
	logger.fatal({ err: error }, 'Fatal error during bootstrap');
	process.exit(1);
});
