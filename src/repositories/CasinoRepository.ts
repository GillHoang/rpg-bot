import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { usersBag, casinoLogs } from '../db/schema.js';

export class CasinoRepository {
	getCredux(executor: Executor, discordId: string): number | null {
		const row = executor
			.select({ credux: usersBag.credux })
			.from(usersBag)
			.where(eq(usersBag.discordId, discordId))
			.get();
		return row?.credux ?? null;
	}

	/** Debits the bet, then credits the payout (0 on a loss) — both against the same balanceBefore for one clean log row. */
	settle(
		executor: Executor,
		discordId: string,
		params: { game: string; bet: number; payout: number; result: string; metadata: Record<string, unknown> },
	): number {
		const before = this.getCredux(executor, discordId);
		if (before == null) throw new Error(`settle: no users_bag row for ${discordId}`);
		const after = before - params.bet + params.payout;
		executor.update(usersBag).set({ credux: after }).where(eq(usersBag.discordId, discordId)).run();
		executor
			.insert(casinoLogs)
			.values({
				discordId,
				game: params.game,
				betAmount: params.bet,
				result: params.result,
				payout: params.payout,
				balanceBefore: before,
				balanceAfter: after,
				metadata: params.metadata,
			})
			.run();
		return after;
	}
}
