import type { ICasinoGame, CasinoOutcome } from '../ICasinoGame.js';
import { SLOT_LADDER } from '../../../config/casinoPayouts.js';

/**
 * ONE mutually-exclusive roll resolved against the ladder's cumulative
 * thresholds, highest prize first; anything past the last rung is a
 * blank (the probabilities intentionally do not sum to 100%).
 */
export class SlotMachineGame implements ICasinoGame {
	readonly key = 'slot_machine';

	play(bet: number, rng: () => number): CasinoOutcome {
		const roll = rng() * 100;
		let threshold = 0;
		for (const rung of SLOT_LADDER) {
			threshold += rung.prob;
			if (roll < threshold) {
				return {
					won: true,
					payout: Math.floor(bet * rung.mult),
					result: rung.face,
					metadata: { face: rung.face, mult: rung.mult },
				};
			}
		}
		return { won: false, payout: 0, result: 'blank', metadata: {} };
	}
}
