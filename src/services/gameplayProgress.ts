import type { QuestType } from '../config/quests.js';
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

/** Gameplay rewards and their core progression commit or roll back together. */
export class GameplayProgressCoordinator {
	private readonly quests: Pick<QuestService, 'progressInTx'>;
	private readonly reputation: Pick<ReputationService, 'awardInTx'>;

	constructor(options: GameplayProgressDependencies = {}) {
		const persistence = options.persistence ?? defaultPersistence;
		this.reputation = options.reputation ?? new ReputationService({ persistence });
		this.quests = options.quests ?? new QuestService(this.reputation, { persistence });
	}

	async apply(tx: Executor, discordId: string, type: QuestType | 'ranked_win', now: Date, amount = 1): Promise<void> {
		if (type !== 'ranked_win') await this.quests.progressInTx(tx, discordId, type, now, amount);
		if (type === 'daily' || type === 'raid_win' || type === 'duel_win' || type === 'ranked_win') {
			await this.reputation.awardInTx(tx, discordId, type, now);
		}
	}
}

const defaultProgress = new GameplayProgressCoordinator();

/** Compatibility entry point for callers using the default composition. */
export async function applyGameplayProgress(
	tx: Executor,
	discordId: string,
	type: QuestType | 'ranked_win',
	now: Date,
	amount = 1,
) {
	await defaultProgress.apply(tx, discordId, type, now, amount);
}
