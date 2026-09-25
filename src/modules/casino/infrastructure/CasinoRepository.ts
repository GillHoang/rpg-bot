import { CASINO_REPOSITORY_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { AppError } from '../../../shared/kernel/Result.js';
import { eq } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { usersBag, casinoLogs } from '../../../db/schema.js';

export class CasinoRepository {
	async getCredux(executor: Executor, discordId: string): Promise<number | null> {
		const [row] = await executor
			.select({ credux: usersBag.credux })
			.from(usersBag)
			.where(eq(usersBag.discordId, discordId))
			.limit(1)
			.for('update');
		return row?.credux ?? null;
	}

	/** Debits the bet, then credits the payout (0 on a loss) — both against the same balanceBefore for one clean log row. */
	async settle(
		executor: Executor,
		discordId: string,
		params: { game: string; bet: number; payout: number; result: string; metadata: Record<string, unknown> },
	): Promise<number> {
		const before = await this.getCredux(executor, discordId);
		if (before == null)
			throw new AppError('CASINO_MISSING_BAG', CASINO_REPOSITORY_ERROR_TEXT.missingBag(discordId));
		const after = before - params.bet + params.payout;
		await executor.update(usersBag).set({ credux: after }).where(eq(usersBag.discordId, discordId));
		await executor.insert(casinoLogs).values({
			discordId,
			game: params.game,
			betAmount: params.bet,
			result: params.result,
			payout: params.payout,
			balanceBefore: before,
			balanceAfter: after,
			metadata: params.metadata,
		});
		return after;
	}
}
