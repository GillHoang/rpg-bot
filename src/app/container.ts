import type { PersistenceContext } from '../shared/kernel/persistence.js';
import { createLivePersistence } from '../db/livePersistence.js';
import type { Clock } from '../shared/kernel/clock.js';
import { systemClock } from '../shared/kernel/clock.js';
import { EventBus } from '../shared/kernel/EventBus.js';
import { BotMaintenance } from './BotMaintenance.js';
import { Scheduler } from './Scheduler.js';
import { BattleEngine } from '../modules/combat-shared/domain/BattleEngine.js';
import { MenuGameplayService } from '../modules/menu/MenuGameplayService.js';
import { MenuRouter } from '../modules/menu/MenuRouter.js';
import { MenuSessionStore } from '../modules/menu/MenuSessionStore.js';
import { PlayerAccountRepository } from '../modules/identity/infrastructure/PlayerAccountRepository.js';
import { UserRepository } from '../modules/identity/infrastructure/UserRepository.js';
import { UserCharacterRepository } from '../modules/identity/infrastructure/UserCharacterRepository.js';
import { GearRepository } from '../modules/progression/infrastructure/GearRepository.js';
import { RuneRepository } from '../modules/progression/infrastructure/RuneRepository.js';
import { PresetRepository } from '../modules/progression/infrastructure/PresetRepository.js';
import { LootRepository } from '../modules/economy/infrastructure/LootRepository.js';
import { MaintenanceRepository } from '../modules/system/infrastructure/MaintenanceRepository.js';
import { StartService } from '../modules/identity/application/StartService.js';
import { EconomyService } from '../modules/economy/application/EconomyService.js';
import { ProfileService } from '../modules/identity/application/ProfileService.js';
import { StatAssemblyService } from '../modules/combat-shared/application/StatAssemblyService.js';
import { QuestService } from '../modules/meta/application/QuestService.js';
import { ReputationService } from '../modules/meta/application/ReputationService.js';
import { CosmeticService } from '../modules/meta/application/CosmeticService.js';
import { ClassChangeService } from '../modules/identity/application/ClassChangeService.js';
import { AscensionService } from '../modules/progression/application/AscensionService.js';
import { CasinoService } from '../modules/casino/application/CasinoService.js';
import { CasinoSessionService } from '../modules/casino/application/CasinoSessionService.js';
import { DuelService } from '../modules/pvp/application/DuelService.js';
import { RaidService } from '../modules/pve/application/RaidService.js';
import { RankedService } from '../modules/pvp/application/RankedService.js';
import { PvpShopService } from '../modules/pvp/application/PvpShopService.js';
import { LootService } from '../modules/economy/application/LootService.js';
import { LoadoutService } from '../modules/progression/application/LoadoutService.js';
import { WeaponService } from '../modules/progression/application/WeaponService.js';
import { SocketService } from '../modules/progression/application/SocketService.js';
import { EnhancementService } from '../modules/progression/application/EnhancementService.js';
import { ResetService } from '../modules/system/application/ResetService.js';
import { InventoryService } from '../modules/progression/application/InventoryService.js';
import { HealthService } from '../modules/system/application/HealthService.js';
import { DeityService } from '../modules/progression/application/DeityService.js';
import { MonsterEncounterService } from '../modules/pve/application/MonsterEncounterService.js';
import { RaidRewardService } from '../modules/pve/application/RaidRewardService.js';
import { LootGrantService } from '../modules/economy/application/LootGrantService.js';
import { GameplayProgressCoordinator } from '../shared/progress/gameplayProgress.js';
import { PlayerCombatantFactory } from '../modules/combat-shared/application/combatantFactory.js';
import { CombatSetup } from '../modules/combat-shared/application/CombatSetup.js';
import { ClaimDailyUseCase } from '../modules/economy/application/ClaimDailyUseCase.js';
import { RunSummonUseCase } from '../modules/progression/application/RunSummonUseCase.js';
import { GetBalanceUseCase } from '../modules/economy/application/GetBalanceUseCase.js';
import type { BattleEngine as BattleEngineType } from '../modules/combat-shared/domain/BattleEngine.js';
import type { StatAssemblyService as StatAssemblyServiceType } from '../modules/combat-shared/application/StatAssemblyService.js';
import type { PlayerCombatantFactory as PlayerCombatantFactoryType } from '../modules/combat-shared/application/combatantFactory.js';
import type { CombatSetup as CombatSetupType } from '../modules/combat-shared/application/CombatSetup.js';

export interface ApplicationOptions {
	persistence?: PersistenceContext;
	events?: EventBus;
	clock?: Clock;
	/** Allows the compatibility bootstrap to keep its existing lazy menu store. */
	menu?: MenuRouter;
}

/**
 * Sole composition root: creates one collaborator graph for commands, menu,
 * events, and maintenance. Construction performs no I/O and starts no
 * background jobs. Request transactions and RNG state stay in the method
 * handling that request.
 */
export interface AppContainer {
	readonly events: EventBus;
	readonly combatSetup: CombatSetup;
	readonly start: StartService;
	readonly daily: ClaimDailyUseCase;
	readonly economy: EconomyService;
	readonly profile: ProfileService;
	readonly quests: QuestService;
	readonly reputation: ReputationService;
	readonly cosmetics: CosmeticService;
	readonly raid: RaidService;
	readonly duel: DuelService;
	readonly ranked: RankedService;
	readonly casinoSessions: CasinoSessionService;
	readonly menu: MenuRouter;
	readonly maintenance: BotMaintenance;
	readonly ascension: AscensionService;
	readonly summon: RunSummonUseCase;
	readonly classChange: ClassChangeService;
	readonly casino: CasinoService;
	readonly pvpShop: PvpShopService;
	readonly loot: LootService;
	readonly loadout: LoadoutService;
	readonly weapon: WeaponService;
	readonly socket: SocketService;
	readonly enhancement: EnhancementService;
	readonly reset: ResetService;
	readonly inventory: InventoryService;
	readonly health: HealthService;
	readonly economyModule: {
		readonly claimDaily: ClaimDailyUseCase;
		readonly getBalance: GetBalanceUseCase;
	};
	readonly combatShared: {
		readonly engine: BattleEngineType;
		readonly factory: PlayerCombatantFactoryType;
		readonly statAssembly: StatAssemblyServiceType;
		readonly setup: CombatSetupType;
	};
	readonly progressionModule: {
		readonly runSummon: RunSummonUseCase;
	};
}

export function createAppContainer(options: ApplicationOptions = {}): AppContainer {
	// Production wiring owns its live context explicitly — the deprecated
	// defaultPersistence global stays reserved for the PGlite test suites.
	const persistence = options.persistence ?? createLivePersistence();
	const events = options.events ?? new EventBus();
	const clock = options.clock ?? systemClock;
	const accounts = new PlayerAccountRepository(persistence.executor);
	const characters = new UserCharacterRepository();
	const gear = new GearRepository();
	const runes = new RuneRepository();
	const deities = new DeityService();
	const lootRepository = new LootRepository();
	const cosmetics = new CosmeticService({ persistence });
	const reputation = new ReputationService({ persistence, clock, cosmetics });
	const quests = new QuestService(reputation, { persistence, clock });
	const progress = new GameplayProgressCoordinator({ persistence, quests, reputation });
	const statAssembly = new StatAssemblyService(gear, deities, runes, { persistence });
	const engine = new BattleEngine();
	const factory = new PlayerCombatantFactory();
	const combatSetup = new CombatSetup(statAssembly, factory, engine);
	const grants = new LootGrantService(lootRepository);
	const start = new StartService(new UserRepository(), characters, gear, new PresetRepository(), cosmetics, {
		persistence,
	});
	const daily = new ClaimDailyUseCase(undefined, events, { persistence, progress, clock });
	const economy = new EconomyService(accounts, events, { persistence });
	const profile = new ProfileService(accounts, characters, statAssembly, { persistence });
	const raid = new RaidService({
		accounts,
		monsters: new MonsterEncounterService(),
		characters,
		rewards: new RaidRewardService(),
		statAssembly,
		cosmetics,
		events,
		clock,
		persistence,
		engine,
		factory,
		combat: combatSetup,
		progress,
		loot: grants,
	});
	const duel = new DuelService(accounts, characters, statAssembly, cosmetics, events, {
		persistence,
		clock,
		engine,
		factory,
		combat: combatSetup,
	});
	const ranked = new RankedService(accounts, statAssembly, cosmetics, events, {
		persistence,
		clock,
		engine,
		factory,
		combat: combatSetup,
	});
	const casinoSessions = new CasinoSessionService({ persistence, clock });
	const menuGameplay = new MenuGameplayService(profile, start, daily, quests, raid, { persistence, clock });
	const menu = options.menu ?? new MenuRouter(new MenuSessionStore(), menuGameplay);
	const scheduler = new Scheduler(duel, new MaintenanceRepository(persistence.executor), clock);
	const maintenance = new BotMaintenance(casinoSessions, scheduler, menu);
	const summon = new RunSummonUseCase(characters, deities, events, { persistence });
	const inventory = new InventoryService(persistence.executor);

	return {
		events,
		combatSetup,
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
		summon,
		classChange: new ClassChangeService({ persistence }),
		casino: new CasinoService(undefined, events, { persistence, clock }),
		pvpShop: new PvpShopService(cosmetics, { persistence }),
		loot: new LootService(lootRepository, events, { persistence, grants, clock }),
		loadout: new LoadoutService({ persistence }),
		weapon: new WeaponService({ persistence }),
		socket: new SocketService(runes, gear, { persistence }),
		enhancement: new EnhancementService(undefined, events, { persistence, clock }),
		reset: new ResetService({ persistence }),
		inventory,
		health: new HealthService(persistence.executor),
		economyModule: {
			claimDaily: daily,
			getBalance: new GetBalanceUseCase(economy, inventory),
		},
		combatShared: {
			engine,
			factory,
			statAssembly,
			setup: combatSetup,
		},
		progressionModule: {
			runSummon: summon,
		},
	};
}

export type ApplicationServices = AppContainer;
