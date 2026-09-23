import { BOOT_LOG_TEXT, DONATION_ERROR_TEXT } from './text/diagnostics.js';
import { DiscordBot } from './core/DiscordBot.js';
import { registerAllCommands } from './core/registerAllCommands.js';
import { subscribeDomainEvents } from './core/subscribeDomainEvents.js';
import { logger, flushErrorWebhook } from './utils/logger.js';
import { createApplicationServices } from './application/createApplicationServices.js';
import { CommandRegistry } from './core/CommandRegistry.js';
import { loadDonationRuntimeConfig } from './config/donationRuntime.js';
import { SepayWebhookServer } from './infrastructure/payments/SepayWebhookServer.js';
import { KeygateSupporterClient } from './infrastructure/payments/KeygateSupporterClient.js';
import { DonationProvisioningWorker } from './infrastructure/payments/DonationProvisioningWorker.js';
import { validateSupporterEntitlements } from './services/SupporterEntitlementPolicy.js';
import { closePersistence } from './infrastructure/persistence/closePersistence.js';

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
let webhook: SepayWebhookServer | null = null;
let worker: DonationProvisioningWorker | null = null;

try {
	const donationConfig = loadDonationRuntimeConfig();
	const services = createApplicationServices({ donationConfig });
	if (donationConfig) {
		const keygate = new KeygateSupporterClient(donationConfig.keygate);
		for (const tier of donationConfig.tiers) {
			const plan = await keygate.getPlan({ slug: tier.keygatePlanSlug });
			if (plan.slug !== tier.keygatePlanSlug) throw new Error(DONATION_ERROR_TEXT.planMismatch);
			validateSupporterEntitlements(plan.entitlements);
		}
		worker = new DonationProvisioningWorker(services.donation, keygate);
		worker.start();
	}
	webhook = donationConfig
		? new SepayWebhookServer({
				service: services.donation,
				host: donationConfig.webhookHost,
				port: donationConfig.webhookPort,
				path: donationConfig.webhookPath,
			})
		: null;
	const registry = new CommandRegistry();
	registerAllCommands(services, registry);
	// Quest progress + believer EXP are pure EventBus subscribers — wire once.
	subscribeDomainEvents(services.events);
	if (webhook) await webhook.start();
	const bot = new DiscordBot({ registry, menu: services.menu, maintenance: services.maintenance });
	await bot.start();
	let stopping = false;
	const shutdown = async () => {
		if (stopping) return;
		stopping = true;
		await webhook?.stop();
		await worker?.stop();
		await bot.stop();
		await closePersistence();
	};
	const onSignal = () => {
		void shutdown().catch((err: unknown) => logger.error({ err }, BOOT_LOG_TEXT.shutdownFailed));
	};
	process.once('SIGINT', onSignal);
	process.once('SIGTERM', onSignal);
} catch (error) {
	await webhook?.stop().catch(() => undefined);
	await worker?.stop().catch(() => undefined);
	logger.fatal({ err: error }, BOOT_LOG_TEXT.bootstrapFailed);
	await flushErrorWebhook();
	process.exit(1);
}
