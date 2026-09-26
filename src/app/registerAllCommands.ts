import { CommandRegistry } from './CommandRegistry.js';
import { BalanceCommand } from '../modules/economy/presentation/BalanceCommand.js';
import { DailyCommand } from '../modules/economy/presentation/DailyCommand.js';
import { StartCommand } from '../modules/identity/presentation/StartCommand.js';
import { RaidCommand } from '../modules/pve/presentation/RaidCommand.js';
import { SummonCommand } from '../modules/progression/presentation/SummonCommand.js';
import { EnhanceCommand } from '../modules/progression/presentation/EnhanceCommand.js';
import { SocketCommand } from '../modules/progression/presentation/SocketCommand.js';
import { CasinoCommand } from '../modules/casino/presentation/CasinoCommand.js';
import { ProfileCommand } from '../modules/identity/presentation/ProfileCommand.js';
import { DeityCommand } from '../modules/progression/presentation/DeityCommand.js';
import { InventoryCommand, DeitiesCommand } from '../modules/progression/presentation/InventoryCommand.js';
import { OpenCommand, RunesCommand } from '../modules/progression/presentation/LootCommand.js';
import { EquipCommand, PresetCommand } from '../modules/progression/presentation/LoadoutCommand.js';
import { BranchCommand } from '../modules/progression/presentation/BranchCommand.js';
import { SkillCommand } from '../modules/progression/presentation/SkillCommand.js';
import { WeaponCommand } from '../modules/progression/presentation/WeaponCommand.js';
import { DuelCommand } from '../modules/pvp/presentation/DuelCommand.js';
import { RankedCommand } from '../modules/pvp/presentation/RankedCommand.js';
import { PvpCommand } from '../modules/pvp/presentation/PvpCommand.js';
import { QuestCommand } from '../modules/meta/presentation/QuestCommand.js';
import { CosmeticCommand } from '../modules/meta/presentation/CosmeticCommand.js';
import { TitleCommand } from '../modules/meta/presentation/TitleCommand.js';
import { ClassCommand } from '../modules/identity/presentation/ClassCommand.js';
import { HelpCommand } from '../modules/system/presentation/HelpCommand.js';
import { TestCommand } from '../modules/system/presentation/TestCommand.js';
import { ResetCommand } from '../modules/system/presentation/ResetCommand.js';
import { PingCommand } from '../modules/system/presentation/PingCommand.js';
import { MenuCommand } from '../modules/menu/presentation/MenuCommand.js';
import { InteractiveCasinoController } from '../modules/casino/presentation/interactiveCasino.js';
import type { ApplicationServices } from './container.js';

/** Services graph; module use-cases ride along on the container. */
export type CommandServices = ApplicationServices;

/**
 * Composition root — the ONLY place that knows the full list of commands.
 * Both the bot bootstrap (index.ts) and `deploy:commands` call this, so a
 * newly ported command can never be registered at runtime but forgotten
 * in the Discord API (or vice versa). Adding a command = add one line here.
 *
 * Services are required explicitly (no default container): building a
 * container is a visible, deliberate act — especially for the deploy
 * script, which needs one even though it only reads command metadata.
 */
export function registerAllCommands(services: CommandServices, registry: Pick<CommandRegistry, 'register'>): void {
	registry.register(new MenuCommand(services.menu));
	registry.register(new StartCommand(services.start));
	registry.register(new BalanceCommand(services.economyModule.getBalance));
	registry.register(new DailyCommand(services.economyModule.claimDaily));
	registry.register(new RaidCommand(services.raid, services.tower));
	registry.register(new SummonCommand(services.progressionModule.runSummon));
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
	registry.register(new BranchCommand(services.branch));
	registry.register(new SkillCommand(services.skills));
	registry.register(new WeaponCommand(services.weapon, services.inventory));
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
