import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { userCharacter } from '../db/schema.js';
import {
	BELIEVER_DAILY_CAP,
	BELIEVER_EXP_SOURCES,
	believerLevelCost,
	type BelieverExpSource,
} from '../config/reputation.js';
import { DailyCycle } from '../utils/dailyCycle.js';

export interface BelieverAwardResult {
	granted: number;
	newLevel: number | null;
}

/**
 * Believer EXP (hệ reputation của bản gốc): EXP từ hành vi hằng ngày, cap
 * theo ngày Manila, level-up nội bộ. Dùng được cả trong tx (duel/ranked/
 * quest cộng cùng giao dịch thưởng) lẫn ngoài tx (event subscriber).
 */
export class ReputationService {
	/** Event-driven path — opens its own transaction. */
	async award(discordId: string, source: BelieverExpSource): Promise<BelieverAwardResult> {
		return db.transaction((tx) => this.awardInTx(tx, discordId, source));
	}

	async awardInTx(tx: Executor, discordId: string, source: BelieverExpSource): Promise<BelieverAwardResult> {
		const amount = BELIEVER_EXP_SOURCES[source];
		const today = DailyCycle.keyAt();
		const [character] = await tx
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1)
			.for('update');
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

		await tx
			.update(userCharacter)
			.set({
				believerExp,
				believerLevel,
				reputationExpToday: alreadyToday + granted,
				reputationExpResetDate: today,
			})
			.where(eq(userCharacter.discordId, discordId));
		return { granted, newLevel };
	}
}
