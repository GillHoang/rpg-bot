import type { ICasinoGame, CasinoOutcome } from '../ICasinoGame.js';
import { EVEN_MONEY } from '../../../config/casinoPayouts.js';

export type CoinSide = 'heads' | 'tails';

/** Even-money coin flip. `choice` is the player's called side. */
export class CoinTossGame implements ICasinoGame {
	readonly key = 'coin_toss';

	play(bet: number, rng: () => number, choice?: string): CasinoOutcome {
		const call: CoinSide = choice === 'tails' ? 'tails' : 'heads';
		const landed: CoinSide = rng() < 0.5 ? 'heads' : 'tails';
		const won = call === landed;
		return {
			won,
			payout: won ? Math.floor(bet * EVEN_MONEY) : 0,
			result: landed,
			metadata: { call, landed },
		};
	}
}
