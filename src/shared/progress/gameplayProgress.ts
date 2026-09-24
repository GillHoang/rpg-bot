import type { QuestType } from '../config/quests.js';
import type { Executor } from '../../db/client.js';
import { requirePersistence, type PersistenceContext } from '../kernel/persistence.js';
import { QuestService } from '../../modules/meta/application/QuestService.js';
import { ReputationService } from '../../modules/meta/application/ReputationService.js';

export interface GameplayProgressDependencies {
	persistence: PersistenceContext;
	quests?: Pick<QuestService, 'progressInTx'>;
	reputation?: Pick<ReputationService, 'awardInTx'>;
}

/** Gameplay rewards and their core progression commit or roll back together. */
export class GameplayProgressCoordinator {
	private readonly quests: Pick<QuestService, 'progressInTx'>;
	private readonly reputation: Pick<ReputationService, 'awardInTx'>;

	constructor(options: GameplayProgressDependencies) {
		const persistence = requirePersistence(options, 'GameplayProgressCoordinator');
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
		// OCP registry: special mappings live here; any other QuestType
		// passes through unchanged so new quest types work without edits.
		let questType: QuestType | null;
		if (type === 'final_boss_win') questType = 'raid_win';
		else if (type === 'ranked_win') questType = null;
		else questType = type as QuestType;
		if (questType) await this.quests.progressInTx(tx, discordId, questType, now, amount);
		if (PROGRESS_REPUTATION_TYPES.has(type)) {
			await this.reputation.awardInTx(
				tx,
				discordId,
				type as Parameters<ReputationService['awardInTx']>[2],
				now,
			);
		}
	}
}

/** Events that also award believer reputation. Register new types here. */
const PROGRESS_REPUTATION_TYPES: ReadonlySet<string> = new Set([
	'daily',
	'raid_win',
	'final_boss_win',
	'duel_win',
	'ranked_win',
]);
