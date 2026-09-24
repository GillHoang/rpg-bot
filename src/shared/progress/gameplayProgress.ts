import type { QuestType } from '../config/quests.js';
import type { Executor } from '../../db/client.js';
import type { PersistenceContext } from '../kernel/persistence.js';
import { defaultPersistence } from '../../db/defaultPersistence.js';
import { QuestService } from '../../modules/meta/application/QuestService.js';
import { ReputationService } from '../../modules/meta/application/ReputationService.js';

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

	async apply(
		tx: Executor,
		discordId: string,
		type: QuestType | 'ranked_win' | 'final_boss_win',
		now: Date,
		amount = 1,
	): Promise<void> {
		// Final Boss gate counts toward raid_win quests but awards its own reputation.
		let questType: QuestType | null;
		if (type === 'final_boss_win') questType = 'raid_win';
		else if (type === 'ranked_win') questType = null;
		else questType = type;
		if (questType) await this.quests.progressInTx(tx, discordId, questType, now, amount);
		if (
			type === 'daily' ||
			type === 'raid_win' ||
			type === 'final_boss_win' ||
			type === 'duel_win' ||
			type === 'ranked_win'
		) {
			await this.reputation.awardInTx(tx, discordId, type, now);
		}
	}
}
