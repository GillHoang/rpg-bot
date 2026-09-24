import { BOOT_LOG_TEXT } from './shared/ui/text/diagnostics.js';
import { logger, flushErrorWebhook } from './shared/utils/logger.js';
import { createAppContainer } from './app/container.js';
import { createBot } from './app/bot.js';

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
	const bot = createBot(createAppContainer());
	await bot.start();
} catch (error) {
	logger.fatal({ err: error }, BOOT_LOG_TEXT.bootstrapFailed);
	await flushErrorWebhook();
	process.exit(1);
}
