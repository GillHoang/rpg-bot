import type { Executor } from '../../../db/client.js';
import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { EventBus } from '../../../shared/kernel/EventBus.js';
import type { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import type { DailyRepository } from '../infrastructure/DailyRepository.js';
import type { EconomyService } from './EconomyService.js';
import type { InventoryService } from '../../progression/application/InventoryService.js';
import type { ClaimDailyResult } from './types.js';

export type { ClaimDailyResult };

/** Structural claim contract used by commands and the menu. */
export interface DailyClaimPort {
	claim(discordId: string, now?: Date): Promise<ClaimDailyResult>;
}

/** Repository port owned by the use-case; DailyRepository is the current adapter. */
export type DailyRepoPort = Pick<
	DailyRepository,
	'hasBag' | 'getDailyState' | 'applyReward' | 'updateStreak' | 'logCurrencyChange' | 'logChestChange'
>;

export type ProgressPort = Pick<GameplayProgressCoordinator, 'apply'>;
export type DailyEventsPort = Pick<EventBus, 'emit'>;

/** Transaction executor passed into repository calls. */
export type TxExecutor = Executor;

export interface ClaimDailyOptions {
	persistence?: PersistenceContext;
	progress?: ProgressPort;
}

export type BalanceQueryPort = Pick<EconomyService, 'getAccount'>;
export type BagQueryPort = Pick<InventoryService, 'bag'>;
