import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { EventBus } from '../../../shared/kernel/EventBus.js';
import type { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import type { SummonRepository } from '../infrastructure/SummonRepository.js';
import type { UserCharacterRepository } from '../../identity/infrastructure/UserCharacterRepository.js';
import type { DeityService } from './DeityService.js';
import type { SummonResult } from './types.js';

export type { SummonResult };

/** Structural run contract used by the summon command. */
export interface SummonRunPort {
	run(
		discordId: string,
		count: number,
		relic?: import('../../../shared/config/gachaRates.js').RelicKind,
	): Promise<SummonResult>;
}

export type SummonRepoPort = Pick<
	SummonRepository,
	| 'lockBag'
	| 'findPity'
	| 'lockCharacter'
	| 'findPreset'
	| 'insertShardLog'
	| 'upsertPity'
	| 'updatePresetDeity'
	| 'updateRelicBalance'
	| 'insertRelicGrant'
	| 'updateShardBalance'
	| 'insertEssenceLog'
	| 'updateEssenceBalances'
>;

export type SummonCharactersPort = Pick<UserCharacterRepository, 'hasCharacter'>;
export type SummonDeitiesPort = Pick<DeityService, 'ownedDeityIds' | 'pickRandomAvailableForTier' | 'insertNew'>;
export type SummonProgressPort = Pick<GameplayProgressCoordinator, 'apply'>;
export type SummonEventsPort = Pick<EventBus, 'emit'>;

export interface RunSummonOptions {
	progress?: SummonProgressPort;
	persistence?: PersistenceContext;
	queries?: SummonRepoPort;
}
