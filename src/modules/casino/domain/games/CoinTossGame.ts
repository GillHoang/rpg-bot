import { choose } from '../../../../shared/utils/weightedRandom.js';
import type { ICasinoGame, CasinoOutcome } from '../ICasinoGame.js';
import { EVEN_MONEY } from '../../../../shared/config/casinoPayouts.js';

export type CoinSide = 'heads' | 'tails';

/** Even-money coin flip. `choice` is the player's called side. */
export class CoinTossGame implements ICasinoGame {
	readonly key = 'coin_toss';

	play(bet: number, rng: () => number, choice?: string): CasinoOutcome {
		const call: CoinSide = choice === 'tails' ? 'tails' : 'heads';
		const landed: CoinSide = choose(['heads', 'tails'] as const, rng);
		const won = call === landed;
		return {
			won,
			payout: won ? Math.floor(bet * EVEN_MONEY) : 0,
			result: landed,
			metadata: { call, landed },
		};
	}
}
