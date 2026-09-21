import type { Executor } from '../db/client.js';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { QuestService } from './QuestService.js';
import { ReputationService } from './ReputationService.js';

export interface GameplayProgressDependencies {
	persistence?: PersistenceContext;
	quests?: Pick<QuestService, 'progressInTx'>;
	reputation?: Pick<ReputationService, 'awardInTx'>;
}

/** Menu rewards and their core progression commit or roll back together. */
export class GameplayProgressCoordinator {
	private readonly quests: Pick<QuestService, 'progressInTx'>;
	private readonly reputation: Pick<ReputationService, 'awardInTx'>;

	constructor(options: GameplayProgressDependencies = {}) {
		const persistence = options.persistence ?? defaultPersistence;
		this.reputation = options.reputation ?? new ReputationService({ persistence });
		this.quests = options.quests ?? new QuestService(this.reputation, { persistence });
	}

	async apply(tx: Executor, discordId: string, type: 'daily' | 'raid_win', now: Date): Promise<void> {
		await this.quests.progressInTx(tx, discordId, type, now);
		await this.reputation.awardInTx(tx, discordId, type, now);
	}
}

const defaultProgress = new GameplayProgressCoordinator();

/** Compatibility entry point for callers using the default composition. */
export async function applyGameplayProgress(tx: Executor, discordId: string, type: 'daily' | 'raid_win', now: Date) {
	await defaultProgress.apply(tx, discordId, type, now);
}
