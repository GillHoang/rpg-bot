import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { ReputationRepository } from '../repositories/ReputationRepository.js';
import type { Executor } from '../db/client.js';

import {
	BELIEVER_DAILY_CAP,
	BELIEVER_EXP_SOURCES,
	believerLevelCost,
	type BelieverExpSource,
} from '../config/reputation.js';
import { DailyCycle } from '../utils/dailyCycle.js';
import { CosmeticService } from './CosmeticService.js';

export interface BelieverAwardResult {
	granted: number;
	newLevel: number | null;
}

export interface ReputationDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<ReputationRepository, 'lockCharacter' | 'updateProgress'>;
	cosmetics?: Pick<CosmeticService, 'grantTitleInTx'>;
}

/**
 * Believer EXP (hệ reputation của bản gốc): EXP từ hành vi hằng ngày, cap
 * theo ngày Manila, level-up nội bộ. Dùng được cả trong tx (duel/ranked/
 * quest cộng cùng giao dịch thưởng) lẫn ngoài tx (event subscriber).
 */

export class ReputationService {
	private readonly persistence: PersistenceContext;
	private readonly queries: NonNullable<ReputationDependencies['queries']>;
	private readonly cosmetics: Pick<CosmeticService, 'grantTitleInTx'>;
	constructor(options: ReputationDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.queries = options.queries ?? new ReputationRepository();
		this.cosmetics = options.cosmetics ?? new CosmeticService({ persistence: this.persistence });
	}
	/** Event-driven path — opens its own transaction. */
	async award(discordId: string, source: BelieverExpSource): Promise<BelieverAwardResult> {
		return this.persistence.unitOfWork.run((tx) => this.awardInTx(tx, discordId, source));
	}

	async awardInTx(
		tx: Executor,
		discordId: string,
		source: BelieverExpSource,
		now = new Date(),
	): Promise<BelieverAwardResult> {
		const amount = BELIEVER_EXP_SOURCES[source];
		const today = DailyCycle.keyAt(now);
		const [character] = await this.queries.lockCharacter(tx, discordId);
		if (!character) return { granted: 0, newLevel: null };

		const resetNeeded = character.reputationExpResetDate !== today;
		const alreadyToday = resetNeeded ? 0 : character.reputationExpToday;
		const granted = Math.min(amount, Math.max(0, BELIEVER_DAILY_CAP - alreadyToday));
		if (granted <= 0) return { granted: 0, newLevel: null };

		let believerExp = character.believerExp + granted;
		let believerLevel = character.believerLevel;
		let newLevel: number | null = null;
		while (believerExp >= believerLevelCost(believerLevel)) {
			believerExp -= believerLevelCost(believerLevel);
			believerLevel += 1;
			newLevel = believerLevel;
		}
		if (newLevel != null && believerLevel >= 10) {
			// Believer level 10 — title Devout Believer (idempotent grant).
			await this.cosmetics.grantTitleInTx(tx, discordId, 'devout_believer');
		}

		await this.queries.updateProgress(tx, discordId, {
			believerExp,
			believerLevel,
			reputationExpToday: alreadyToday + granted,
			reputationExpResetDate: today,
		});
		return { granted, newLevel };
	}
}
