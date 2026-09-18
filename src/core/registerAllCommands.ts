import { CommandRegistry } from './CommandRegistry.js';
import { BalanceCommand } from '../commands/economy/BalanceCommand.js';
import { DailyCommand } from '../commands/economy/DailyCommand.js';
import { RegisterCommand } from '../commands/rpg/RegisterCommand.js';
import { CreateCharacterCommand } from '../commands/rpg/CreateCharacterCommand.js';
import { RaidCommand } from '../commands/rpg/RaidCommand.js';
import { SummonCommand } from '../commands/rpg/SummonCommand.js';
import { EnhanceCommand } from '../commands/rpg/EnhanceCommand.js';
import { SocketCommand } from '../commands/rpg/SocketCommand.js';
import { CasinoCommand } from '../commands/casino/CasinoCommand.js';
import { ProfileCommand } from '../commands/rpg/ProfileCommand.js';
import { DeityCommand } from '../commands/rpg/DeityCommand.js';

/**
 * Composition root — the ONLY place that knows the full list of commands.
 * Both the bot bootstrap (index.ts) and `deploy:commands` call this, so a
 * newly ported command can never be registered at runtime but forgotten
 * in the Discord API (or vice versa). Adding a command = add one line here.
 */
export function registerAllCommands(): void {
	const registry = CommandRegistry.getInstance();

	registry.register(new RegisterCommand());
	registry.register(new CreateCharacterCommand());
	registry.register(new BalanceCommand());
	registry.register(new DailyCommand());
	registry.register(new RaidCommand());
	registry.register(new SummonCommand());
	registry.register(new EnhanceCommand());
	registry.register(new SocketCommand());
	registry.register(new CasinoCommand());
	registry.register(new ProfileCommand());
	registry.register(new DeityCommand());
	// ...ported one module at a time per the migration roadmap.
}
