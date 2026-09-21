import { DiscordBot } from './core/DiscordBot.js';
import { registerAllCommands } from './core/registerAllCommands.js';
import { subscribeDomainEvents } from './core/subscribeDomainEvents.js';
import { logger } from './utils/logger.js';
import { createApplicationServices } from './application/createApplicationServices.js';
import { CommandRegistry } from './core/CommandRegistry.js';

// A stray rejection (e.g. a DiscordAPIError escaping an event handler)
// must log, not take the bot down with Node's default behavior.
process.on('unhandledRejection', (reason) => {
	logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
	logger.fatal({ err }, 'Uncaught exception — exiting');
	process.exit(1);
});

// Top-level await (ESM): bootstrap failures surface as a plain fatal log.
try {
	const services = createApplicationServices();
	const registry = new CommandRegistry();
	registerAllCommands(services, registry);
	// Quest progress + believer EXP are pure EventBus subscribers — wire once.
	subscribeDomainEvents(services.events, services.quests, services.reputation);
	const bot = new DiscordBot({ registry, menu: services.menu, maintenance: services.maintenance });
	await bot.start();
} catch (error) {
	logger.fatal({ err: error }, 'Fatal error during bootstrap');
	process.exit(1);
}
