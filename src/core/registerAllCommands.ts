import { CommandRegistry } from './CommandRegistry.js';
import { BalanceCommand } from '../commands/economy/BalanceCommand.js';
import { DailyCommand } from '../commands/economy/DailyCommand.js';
import { StartCommand } from '../commands/rpg/StartCommand.js';
import { RaidCommand } from '../commands/rpg/RaidCommand.js';
import { SummonCommand } from '../commands/rpg/SummonCommand.js';
import { EnhanceCommand } from '../commands/rpg/EnhanceCommand.js';
import { SocketCommand } from '../commands/rpg/SocketCommand.js';
import { CasinoCommand } from '../commands/casino/CasinoCommand.js';
import { ProfileCommand } from '../commands/rpg/ProfileCommand.js';
import { DeityCommand } from '../commands/rpg/DeityCommand.js';
import { InventoryCommand, DeitiesCommand } from '../commands/rpg/InventoryCommand.js';
import { OpenCommand, RunesCommand } from '../commands/rpg/LootCommand.js';
import { EquipCommand, PresetCommand } from '../commands/rpg/LoadoutCommand.js';
import { DuelCommand } from '../commands/rpg/DuelCommand.js';
import { RankedCommand } from '../commands/rpg/RankedCommand.js';
import { PvpCommand } from '../commands/rpg/PvpCommand.js';
import { QuestCommand } from '../commands/rpg/QuestCommand.js';
import { CosmeticCommand } from '../commands/rpg/CosmeticCommand.js';
import { TitleCommand } from '../commands/rpg/TitleCommand.js';
import { ClassCommand } from '../commands/rpg/ClassCommand.js';
import { HelpCommand } from '../commands/rpg/HelpCommand.js';
import { TestCommand } from '../commands/admin/TestCommand.js';
import { ResetCommand } from '../commands/admin/ResetCommand.js';
import { PingCommand } from '../commands/admin/PingCommand.js';
import { MenuCommand } from '../commands/rpg/MenuCommand.js';

/**
 * Composition root — the ONLY place that knows the full list of commands.
 * Both the bot bootstrap (index.ts) and `deploy:commands` call this, so a
 * newly ported command can never be registered at runtime but forgotten
 * in the Discord API (or vice versa). Adding a command = add one line here.
 */
export function registerAllCommands(): void {
	const registry = CommandRegistry.getInstance();

	registry.register(new MenuCommand());
	registry.register(new StartCommand());
	registry.register(new BalanceCommand());
	registry.register(new DailyCommand());
	registry.register(new RaidCommand());
	registry.register(new SummonCommand());
	registry.register(new EnhanceCommand());
	registry.register(new SocketCommand());
	registry.register(new CasinoCommand());
	registry.register(new ProfileCommand());
	registry.register(new DeityCommand());
	registry.register(new InventoryCommand());
	registry.register(new DeitiesCommand());
	registry.register(new OpenCommand());
	registry.register(new RunesCommand());
	registry.register(new EquipCommand());
	registry.register(new PresetCommand());
	registry.register(new DuelCommand());
	registry.register(new RankedCommand());
	registry.register(new PvpCommand());
	registry.register(new QuestCommand());
	registry.register(new CosmeticCommand());
	registry.register(new TitleCommand());
	registry.register(new ClassCommand());
	registry.register(new HelpCommand());
	registry.register(new TestCommand());
	registry.register(new ResetCommand());
	registry.register(new PingCommand());
	// ...ported one module at a time per the migration roadmap.
}
