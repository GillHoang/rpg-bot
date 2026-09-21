import type { Executor } from '../db/client.js';
import { QuestService } from './QuestService.js';
import { ReputationService } from './ReputationService.js';

/** Menu rewards and their core progression commit or roll back together. */
export async function applyGameplayProgress(tx: Executor, discordId: string, type: 'daily' | 'raid_win', now: Date) {
	await new QuestService().progressInTx(tx, discordId, type, now);
	await new ReputationService().awardInTx(tx, discordId, type, now);
}
