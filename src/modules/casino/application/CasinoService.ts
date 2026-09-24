import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import { defaultPersistence } from '../../../db/defaultPersistence.js';
import { CasinoRepository } from '../infrastructure/CasinoRepository.js';
import { CasinoGameRegistry, type StatelessCasinoGameKey } from '../domain/CasinoGameRegistry.js';
import type { CasinoOutcome } from '../domain/ICasinoGame.js';
import { MAX_BET } from '../../../shared/config/casinoPayouts.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';

export type PlayResult =
	| { status: 'not-registered' }
	| { status: 'invalid-bet' }
	| { status: 'insufficient-credux'; have: number }
	| { status: 'ok'; outcome: CasinoOutcome; balanceAfter: number };

export interface CasinoDependencies {
	progress?: Pick<GameplayProgressCoordinator, 'apply'>;
	persistence?: PersistenceContext;
}

/**
 * Facade for the 4 stateless casino games. One transaction per round:
 * debit the bet, resolve the ICasinoGame strategy, credit the payout,
 * log to casino_logs — all atomic, same discipline as every other
 * multi-write service in this codebase.
 */

export class CasinoService {
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly persistence: PersistenceContext;
	private readonly repo: Pick<CasinoRepository, 'getCredux' | 'settle'>;
	private readonly events: Pick<EventBus, 'emit'>;

	constructor(
		repo?: Pick<CasinoRepository, 'getCredux' | 'settle'>,
		events?: Pick<EventBus, 'emit'>,
		options: CasinoDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.repo = repo ?? new CasinoRepository();
		this.events = events ?? EventBus.getInstance();
	}

	async play(discordId: string, game: StatelessCasinoGameKey, bet: number, choice?: string): Promise<PlayResult> {
		if (!Number.isInteger(bet) || bet <= 0 || bet > MAX_BET) return { status: 'invalid-bet' };

		const result = await this.persistence.unitOfWork.run(async (tx): Promise<PlayResult> => {
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

			await this.progress.apply(tx, discordId, 'casino', new Date());
			return { status: 'ok', outcome, balanceAfter };
		});

		if (result.status === 'ok') {
			this.events.emit('casino.played', { discordId, game, progressApplied: true });
		}
		return result;
	}
}
