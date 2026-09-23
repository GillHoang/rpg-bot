import { BOOT_LOG_TEXT } from './text/diagnostics.js';
import { DiscordBot } from './core/DiscordBot.js';
import { registerAllCommands } from './core/registerAllCommands.js';
import { subscribeDomainEvents } from './core/subscribeDomainEvents.js';
import { logger, flushErrorWebhook } from './utils/logger.js';
import { createApplicationServices } from './application/createApplicationServices.js';
import { CommandRegistry } from './core/CommandRegistry.js';

// A stray rejection (e.g. a DiscordAPIError escaping an event handler)
// must log, not take the bot down with Node's default behavior.
process.on('unhandledRejection', (reason) => {
	logger.error({ err: reason }, BOOT_LOG_TEXT.unhandledRejection);
});
process.on('uncaughtException', (err) => {
	logger.fatal({ err }, BOOT_LOG_TEXT.uncaughtException);
	void flushErrorWebhook().finally(() => process.exit(1));
});

// Top-level await (ESM): bootstrap failures surface as a plain fatal log.
try {
	const services = createApplicationServices();
	const registry = new CommandRegistry();
	registerAllCommands(services, registry);
	// Quest progress + believer EXP are pure EventBus subscribers — wire once.
	subscribeDomainEvents(services.events);
	const bot = new DiscordBot({ registry, menu: services.menu, maintenance: services.maintenance });
	await bot.start();
} catch (error) {
	logger.fatal({ err: error }, BOOT_LOG_TEXT.bootstrapFailed);
	await flushErrorWebhook();
	process.exit(1);
}
