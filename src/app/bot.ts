import type { Client } from 'discord.js';
import { DiscordBot } from './DiscordBot.js';
import { CommandRegistry } from './CommandRegistry.js';
import { registerAllCommands } from './registerAllCommands.js';
import { subscribeDomainEvents } from './events.js';
import type { AppContainer } from './container.js';

export interface BotOptions {
	client?: Client;
	registry?: CommandRegistry;
}

/**
 * Application bootstrap: registry + events + client wiring in one place.
 * `src/index.ts` only handles process signals; everything else lives here.
 */
export function createBot(container: AppContainer, options: BotOptions = {}): DiscordBot {
	const registry = options.registry ?? new CommandRegistry();
	registerAllCommands(container, registry);
	// Quest progress + believer EXP are pure EventBus subscribers — wire once.
	subscribeDomainEvents(container.events);
	return new DiscordBot({
		client: options.client,
		registry,
		menu: container.menu,
		maintenance: container.maintenance,
	});
}
