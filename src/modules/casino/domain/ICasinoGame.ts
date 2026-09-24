export interface CasinoOutcome {
	won: boolean;
	/** Gross amount returned to the player (0 on a loss; includes the stake back on a win). */
	payout: number;
	/** Short machine-readable result tag for casino_logs.result (e.g. 'heads', 'bust', 'jackpot'). */
	result: string;
	/** Extra fields for the reply/log (dice rolled, cards drawn, slot faces...). */
	metadata: Record<string, unknown>;
}

/**
 * Strategy pattern: one implementation per one-shot casino game (resolved
 * in a single call — no player mid-round decision). Blackjack/Crash need
 * real multi-turn state instead (see their own Session classes) and are
 * intentionally not implementations of this interface.
 */
export interface ICasinoGame {
	readonly key: string;
	play(bet: number, rng: () => number, choice?: string): CasinoOutcome;
}
