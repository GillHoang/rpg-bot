import { db } from '../db/client.js';
import { CasinoRepository } from '../repositories/CasinoRepository.js';
import { CasinoGameRegistry, type StatelessCasinoGameKey } from '../domain/casino/CasinoGameRegistry.js';
import type { CasinoOutcome } from '../domain/casino/ICasinoGame.js';
import { MAX_BET } from '../config/casinoPayouts.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';

export type PlayResult =
	| { status: 'not-registered' }
	| { status: 'invalid-bet' }
	| { status: 'insufficient-credux'; have: number }
	| { status: 'ok'; outcome: CasinoOutcome; balanceAfter: number };

/**
 * Facade for the 4 stateless casino games. One transaction per round:
 * debit the bet, resolve the ICasinoGame strategy, credit the payout,
 * log to casino_logs — all atomic, same discipline as every other
 * multi-write service in this codebase.
 */
export class CasinoService {
	constructor(private readonly repo = new CasinoRepository()) {}

	play(discordId: string, game: StatelessCasinoGameKey, bet: number, choice?: string): PlayResult {
		if (!Number.isInteger(bet) || bet <= 0 || bet > MAX_BET) return { status: 'invalid-bet' };

		return db.transaction((tx): PlayResult => {
			const credux = this.repo.getCredux(tx, discordId);
			if (credux == null) return { status: 'not-registered' };
			if (credux < bet) return { status: 'insufficient-credux', have: credux };

			const rng = createRng(createSecureSeed());
			const outcome = CasinoGameRegistry.get(game).play(bet, rng, choice);

			const balanceAfter = this.repo.settle(tx, discordId, {
				game,
				bet,
				payout: outcome.payout,
				result: outcome.result,
				metadata: outcome.metadata,
			});

			return { status: 'ok', outcome, balanceAfter };
		});
	}
}
