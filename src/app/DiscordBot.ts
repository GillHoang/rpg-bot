import { BOT_LOG_TEXT } from '../shared/ui/text/diagnostics.js';
import { Client, Events, GatewayIntentBits, type Interaction } from 'discord.js';
import { CommandRegistry } from './CommandRegistry.js';
import { BotMaintenance } from './BotMaintenance.js';
import { logger } from '../shared/utils/logger.js';
import { env } from '../shared/config/env.js';
import { menuRouter } from '../modules/menu/menuRuntime.js';
import type { MenuRouter } from '../modules/menu/MenuRouter.js';

export interface DiscordBotDependencies {
	client?: Client;
	registry?: Pick<CommandRegistry, 'dispatch' | 'dispatchAutocomplete'>;
	menu?: Pick<MenuRouter, 'handle'>;
	maintenance?: Pick<BotMaintenance, 'start' | 'stop'>;
}

/**
 * Thin wrapper around discord.js Client. Owns only wiring/lifecycle;
 * all actual behaviour lives in ICommand implementations dispatched via
 * CommandRegistry (Command pattern) so this class never grows the way
 * a monolithic index.js typically does.
 */
export class DiscordBot {
	private readonly client: Client;
	private readonly registry: Pick<CommandRegistry, 'dispatch' | 'dispatchAutocomplete'>;
	private readonly menu: Pick<MenuRouter, 'handle'>;
	private readonly maintenance: Pick<BotMaintenance, 'start' | 'stop'>;

	constructor(options: DiscordBotDependencies = {}) {
		this.client = options.client ?? new Client({ intents: [GatewayIntentBits.Guilds] });
		this.registry = options.registry ?? CommandRegistry.getInstance();
		this.menu = options.menu ?? menuRouter;
		this.maintenance = options.maintenance ?? new BotMaintenance();
		this.registerEventHandlers();
	}

	private registerEventHandlers(): void {
		this.client.on(Events.Error, (err) => logger.error({ err }, BOT_LOG_TEXT.clientError));
		this.client.on(Events.ShardError, (err, shardId) => logger.error({ err, shardId }, BOT_LOG_TEXT.shardError));
		this.client.once(Events.ClientReady, (c) => {
			logger.info(BOT_LOG_TEXT.loggedIn(c.user.tag));
			this.maintenance.start();
		});

		this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
			if (await this.menu.handle(interaction)) return;
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

	async stop(): Promise<void> {
		this.maintenance.stop();
		await this.client.destroy();
	}
}
