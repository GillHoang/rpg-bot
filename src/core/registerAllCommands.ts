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
import { InteractiveCasinoController } from '../commands/casino/interactiveCasino.js';
import { createApplicationServices, type ApplicationServices } from '../application/createApplicationServices.js';
import { EventBus } from './EventBus.js';
import { menuRouter } from '../menu/menuRuntime.js';

/**
 * Composition root — the ONLY place that knows the full list of commands.
 * Both the bot bootstrap (index.ts) and `deploy:commands` call this, so a
 * newly ported command can never be registered at runtime but forgotten
 * in the Discord API (or vice versa). Adding a command = add one line here.
 */
export function registerAllCommands(
	services: ApplicationServices = createApplicationServices({ events: EventBus.getInstance(), menu: menuRouter }),
	registry: Pick<CommandRegistry, 'register'> = CommandRegistry.getInstance(),
): void {
	registry.register(new MenuCommand(services.menu));
	registry.register(new StartCommand(services.start));
	registry.register(new BalanceCommand(services.economy, services.inventory));
	registry.register(new DailyCommand(services.daily));
	registry.register(new RaidCommand(services.raid));
	registry.register(new SummonCommand(services.summon));
	registry.register(new EnhanceCommand(services.enhancement, services.inventory));
	registry.register(new SocketCommand(services.socket, services.inventory));
	registry.register(new CasinoCommand(services.casino, new InteractiveCasinoController(services.casinoSessions)));
	registry.register(new ProfileCommand(services.profile));
	registry.register(new DeityCommand(services.ascension));
	registry.register(new InventoryCommand(services.inventory));
	registry.register(new DeitiesCommand(services.inventory));
	registry.register(new OpenCommand(services.loot));
	registry.register(new RunesCommand(services.loot));
	registry.register(new EquipCommand(services.loadout, services.inventory));
	registry.register(new PresetCommand(services.loadout));
	registry.register(new DuelCommand(services.duel));
	registry.register(new RankedCommand(services.ranked));
	registry.register(new PvpCommand(services.pvpShop));
	registry.register(new QuestCommand(services.quests));
	registry.register(new CosmeticCommand(services.cosmetics));
	registry.register(new TitleCommand(services.cosmetics));
	registry.register(new ClassCommand(services.classChange));
	registry.register(new HelpCommand());
	registry.register(new TestCommand());
	registry.register(new ResetCommand(services.reset));
	registry.register(new PingCommand(services.health));
}
