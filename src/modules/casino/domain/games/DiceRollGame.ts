import { choose } from '../../../../shared/utils/weightedRandom.js';
import type { ICasinoGame, CasinoOutcome } from '../ICasinoGame.js';
import { EVEN_MONEY } from '../../../../shared/config/casinoPayouts.js';

function rollDie(rng: () => number): number {
	return choose([1, 2, 3, 4, 5, 6], rng);
}

/** Two independent d6; sum's parity (odd/even) vs the player's pick, even money. */
export class DiceRollGame implements ICasinoGame {
	readonly key = 'dice_roll';

	play(bet: number, rng: () => number, choice?: string): CasinoOutcome {
		const pick = choice === 'even' ? 'even' : 'odd';
		const d1 = rollDie(rng);
		const d2 = rollDie(rng);
		const sum = d1 + d2;
		const parity = sum % 2 === 0 ? 'even' : 'odd';
		const won = parity === pick;
		return {
			won,
			payout: won ? Math.floor(bet * EVEN_MONEY) : 0,
			result: parity,
			metadata: { d1, d2, sum, pick },
		};
	}
}
