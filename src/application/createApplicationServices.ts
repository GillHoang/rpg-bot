import type { PersistenceContext } from './ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { EventBus } from '../core/EventBus.js';
import { BotMaintenance } from '../core/BotMaintenance.js';
import { Scheduler } from '../core/Scheduler.js';
import { BattleEngine } from '../domain/combat/BattleEngine.js';
import { MenuGameplayService } from '../menu/MenuGameplayService.js';
import { MenuRouter } from '../menu/MenuRouter.js';
import { MenuSessionStore } from '../menu/MenuSessionStore.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { GearRepository } from '../repositories/GearRepository.js';
import { RuneRepository } from '../repositories/RuneRepository.js';
import { PresetRepository } from '../repositories/PresetRepository.js';
import { LootRepository } from '../repositories/LootRepository.js';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository.js';
import { StartService } from '../services/StartService.js';
import { DailyService } from '../services/DailyService.js';
import { EconomyService } from '../services/EconomyService.js';
import { ProfileService } from '../services/ProfileService.js';
import { StatAssemblyService } from '../services/StatAssemblyService.js';
import { QuestService } from '../services/QuestService.js';
import { ReputationService } from '../services/ReputationService.js';
import { CosmeticService } from '../services/CosmeticService.js';
import { ClassChangeService } from '../services/ClassChangeService.js';
import { AscensionService } from '../services/AscensionService.js';
import { SummonService } from '../services/SummonService.js';
import { CasinoService } from '../services/CasinoService.js';
import { CasinoSessionService } from '../services/CasinoSessionService.js';
import { DuelService } from '../services/DuelService.js';
import { RaidService } from '../services/RaidService.js';
import { RankedService } from '../services/RankedService.js';
import { PvpShopService } from '../services/PvpShopService.js';
import { LootService } from '../services/LootService.js';
import { LoadoutService } from '../services/LoadoutService.js';
import { SocketService } from '../services/SocketService.js';
import { EnhancementService } from '../services/EnhancementService.js';
import { ResetService } from '../services/ResetService.js';
import { InventoryService } from '../services/InventoryService.js';
import { HealthService } from '../services/HealthService.js';
import { DeityService } from '../services/DeityService.js';
import { MonsterEncounterService } from '../services/MonsterEncounterService.js';
import { RaidRewardService } from '../services/RaidRewardService.js';
import { LootGrantService } from '../services/LootGrantService.js';
import { GameplayProgressCoordinator } from '../services/gameplayProgress.js';
import { PlayerCombatantFactory } from '../services/combatantFactory.js';

export interface ApplicationOptions {
	persistence?: PersistenceContext;
	events?: EventBus;
	/** Allows the compatibility bootstrap to keep its existing lazy menu store. */
	menu?: MenuRouter;
}

/**
 * Composition root: creates one collaborator graph for commands, menu, events,
 * and maintenance. Construction performs no I/O and starts no background jobs.
 * Request transactions and RNG state stay in the method handling that request.
 */
export function createApplicationServices(options: ApplicationOptions = {}) {
	const persistence = options.persistence ?? defaultPersistence;
	const events = options.events ?? new EventBus();
	const accounts = new PlayerAccountRepository(persistence.executor);
	const characters = new UserCharacterRepository();
	const gear = new GearRepository();
	const runes = new RuneRepository();
	const deities = new DeityService();
	const lootRepository = new LootRepository();
	const cosmetics = new CosmeticService({ persistence });
	const reputation = new ReputationService({ persistence, cosmetics });
	const quests = new QuestService(reputation, { persistence });
	const progress = new GameplayProgressCoordinator({ persistence, quests, reputation });
	const statAssembly = new StatAssemblyService(gear, deities, runes, { persistence });
	const engine = new BattleEngine();
	const factory = new PlayerCombatantFactory();
	const grants = new LootGrantService(lootRepository);
	const start = new StartService(new UserRepository(), characters, gear, new PresetRepository(), cosmetics, {
		persistence,
	});
	const daily = new DailyService(undefined, events, { persistence, progress });
	const economy = new EconomyService(accounts, events, { persistence });
	const profile = new ProfileService(accounts, characters, statAssembly, { persistence });
	const raid = new RaidService(
		accounts,
		new MonsterEncounterService(),
		characters,
		new RaidRewardService(),
		statAssembly,
		cosmetics,
		events,
		{ persistence, engine, factory, progress, loot: grants },
	);
	const duel = new DuelService(accounts, characters, statAssembly, cosmetics, events, {
		persistence,
		engine,
		factory,
	});
	const ranked = new RankedService(accounts, statAssembly, cosmetics, events, { persistence, engine, factory });
	const casinoSessions = new CasinoSessionService({ persistence });
	const menuGameplay = new MenuGameplayService(profile, start, daily, quests, raid, { persistence });
	const menu = options.menu ?? new MenuRouter(new MenuSessionStore(), menuGameplay);
	const scheduler = new Scheduler(duel, new MaintenanceRepository(persistence.executor));
	const maintenance = new BotMaintenance(casinoSessions, scheduler, menu);

	return {
		events,
		start,
		daily,
		economy,
		profile,
		quests,
		reputation,
		cosmetics,
		raid,
		duel,
		ranked,
		casinoSessions,
		menu,
		maintenance,
		ascension: new AscensionService(deities, { persistence }),
		summon: new SummonService(characters, deities, events, { persistence }),
		classChange: new ClassChangeService({ persistence }),
		casino: new CasinoService(undefined, events, { persistence }),
		pvpShop: new PvpShopService(cosmetics, { persistence }),
		loot: new LootService(lootRepository, events, { persistence, grants }),
		loadout: new LoadoutService({ persistence }),
		socket: new SocketService(runes, gear, { persistence }),
		enhancement: new EnhancementService(undefined, events, { persistence }),
		reset: new ResetService({ persistence }),
		inventory: new InventoryService(persistence.executor),
		health: new HealthService(persistence.executor),
	};
}

export type ApplicationServices = ReturnType<typeof createApplicationServices>;
