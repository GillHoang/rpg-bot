import type { ICasinoGame, CasinoOutcome } from '../ICasinoGame.js';
import { SLOT_LADDER } from '../../../config/casinoPayouts.js';
import { pick } from '../../../utils/weightedRandom.js';

/**
 * ONE mutually-exclusive roll resolved against the ladder's cumulative
 * thresholds, highest prize first; anything past the last rung is a
 * blank (the probabilities intentionally do not sum to 100%).
 */
export class SlotMachineGame implements ICasinoGame {
	readonly key = 'slot_machine';

	play(bet: number, rng: () => number): CasinoOutcome {
		const rung = pick(
			[
				...SLOT_LADDER.map((original) => ({
					original: { face: original.face as string, mult: original.mult },
					weight: original.prob,
				})),
				{ original: { face: 'blank', mult: 0 }, weight: 100 - SLOT_LADDER.reduce((sum, r) => sum + r.prob, 0) },
			].filter((x) => x.weight > 0),
			{ next: rng },
		);
		if (rung.mult > 0)
			return {
				won: true,
				payout: Math.floor(bet * rung.mult),
				result: rung.face,
				metadata: { face: rung.face, mult: rung.mult },
			};
		return { won: false, payout: 0, result: 'blank', metadata: {} };
	}
}
