import { Client, Events, GatewayIntentBits, type Interaction } from 'discord.js';
import { CommandRegistry } from './CommandRegistry.js';
import { Scheduler } from './Scheduler.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { CasinoSessionService } from '../services/CasinoSessionService.js';
import { menuRouter } from '../menu/menuRuntime.js';

/**
 * Thin wrapper around discord.js Client. Owns only wiring/lifecycle;
 * all actual behaviour lives in ICommand implementations dispatched via
 * CommandRegistry (Command pattern) so this class never grows the way
 * a monolithic index.js typically does.
 */
export class DiscordBot {
	private readonly client: Client;
	private readonly registry = CommandRegistry.getInstance();

	constructor() {
		this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
		this.registerEventHandlers();
	}

	private registerEventHandlers(): void {
		this.client.once(Events.ClientReady, (c) => {
			logger.info(`Logged in as ${c.user.tag}`);
			const sessions = new CasinoSessionService();
			let recovering = false;
			const recover = async () => {
				if (recovering) return;
				recovering = true;
				try {
					await sessions.recoverExpired();
				} catch (error) {
					logger.error({ error }, 'Casino expiry recovery failed');
				} finally {
					recovering = false;
				}
			};
			void recover();
			setInterval(() => void recover(), 15000).unref();
			new Scheduler().start();
			setInterval(() => menuRouter.sweep(), 60_000).unref();
		});

		this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
			if (await menuRouter.handle(interaction)) return;
			if (interaction.isAutocomplete()) {
				await this.registry.dispatchAutocomplete(interaction);
				return;
			}
			if (!interaction.isChatInputCommand()) return;
			await this.registry.dispatch(interaction);
		});
	}

	async start(): Promise<void> {
		await this.client.login(env.DISCORD_TOKEN);
	}
}
