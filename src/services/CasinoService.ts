import { db } from '../db/client.js';
import { CasinoRepository } from '../repositories/CasinoRepository.js';
import { CasinoGameRegistry, type StatelessCasinoGameKey } from '../domain/casino/CasinoGameRegistry.js';
import type { CasinoOutcome } from '../domain/casino/ICasinoGame.js';
import { MAX_BET } from '../config/casinoPayouts.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';

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
	constructor(
		private readonly repo = new CasinoRepository(),
		private readonly events = EventBus.getInstance(),
	) {}

	async play(discordId: string, game: StatelessCasinoGameKey, bet: number, choice?: string): Promise<PlayResult> {
		if (!Number.isInteger(bet) || bet <= 0 || bet > MAX_BET) return { status: 'invalid-bet' };

		const result = await db.transaction(async (tx): Promise<PlayResult> => {
			const creux = await this.repo.getCredux(tx, discordId);
			if (creux == null) return { status: 'not-registered' };
			if (creux < bet) return { status: 'insufficient-credux', have: creux };

			const rng = createRng(createSecureSeed());
			const outcome = CasinoGameRegistry.get(game).play(bet, rng, choice);

			const balanceAfter = await this.repo.settle(tx, discordId, {
				game,
				bet,
				payout: outcome.payout,
				result: outcome.result,
				metadata: outcome.metadata,
			});

			return { status: 'ok', outcome, balanceAfter };
		});

		if (result.status === 'ok') {
			this.events.emit('casino.played', { discordId, game });
		}
		return result;
	}
}
