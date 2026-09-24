import { formatNumber } from '../../../shared/ui/text/format.js';
import {
	CASINO_SESSION_TEXT,
	CASINO_SESSION_BAD_BET,
	CASINO_SESSION_BUSY,
	CASINO_SESSION_INSUFFICIENT,
	CASINO_SESSION_NO_REGISTER,
	CASINO_SESSION_NOT_FOUND,
	CASINO_SETTLE_LINE,
} from '../../../shared/ui/text/casino.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import { defaultPersistence } from '../../../db/defaultPersistence.js';
import { CasinoSessionRepository } from '../infrastructure/CasinoSessionRepository.js';
import type { activeCasinoSessions } from '../../../db/schema.js';
import { randomUUID } from 'node:crypto';
import type { Executor } from '../../../db/client.js';
import { createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { systemClock, type Clock } from '../../../shared/kernel/clock.js';
import { replayGame, type InteractiveGame, type CasinoAction, type StoredGame } from '../domain/InteractiveGame.js';
import { MAX_BET } from '../../../shared/config/casinoPayouts.js';

export type SessionView =
	| { status: 'ok'; sessionId: string; game: InteractiveGame; done: boolean; text: string; revision: number }
	| { status: 'error'; text: string };
export interface CasinoSessionDependencies {
	progress?: Pick<GameplayProgressCoordinator, 'apply'>;
	persistence?: PersistenceContext;
	clock?: Clock;
	queries?: Pick<
		CasinoSessionRepository,
		| 'lockBag'
		| 'findActiveSessions'
		| 'createSession'
		| 'updateBag'
		| 'lockOwnedSession'
		| 'updateSession'
		| 'findBag'
		| 'insertLog'
		| 'findExpiredSessions'
	>;
}

export class CasinoSessionService {
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly queries: Pick<
		CasinoSessionRepository,
		| 'lockBag'
		| 'findActiveSessions'
		| 'createSession'
		| 'updateBag'
		| 'lockOwnedSession'
		| 'updateSession'
		| 'findBag'
		| 'insertLog'
		| 'findExpiredSessions'
	>;

	constructor(options: CasinoSessionDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.clock = options.clock ?? systemClock;
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.queries = options.queries ?? new CasinoSessionRepository();
	}
	async start(id: string, game: InteractiveGame, bet: number): Promise<SessionView> {
		if (!Number.isSafeInteger(bet) || bet <= 0 || bet > MAX_BET)
			return { status: 'error', text: CASINO_SESSION_BAD_BET(MAX_BET) };
		return this.persistence.unitOfWork.run(async (tx) => {
			const [bag] = await this.queries.lockBag(tx, id);
			if (!bag) return { status: 'error', text: CASINO_SESSION_NO_REGISTER };
			const active = await this.queries.findActiveSessions(tx, id);
			if (active.length) return { status: 'error', text: CASINO_SESSION_BUSY };
			if (bag.credux < bet) return { status: 'error', text: CASINO_SESSION_INSUFFICIENT };
			const sessionId = randomUUID();
			const stored: StoredGame = { seed: createSecureSeed(), actions: [] };
			const [session] = await this.queries.createSession(tx, {
				sessionId,
				discordId: id,
				game,
				status: 'active',
				betAmount: bet,
				balanceBefore: bag.credux,
				balanceAfterDebit: bag.credux - bet,
				stateJson: stored,
				expiresAt: new Date(this.clock.now().getTime() + 60000),
			});
			await this.queries.updateBag(tx, id, { credux: bag.credux - bet });
			return this.resolve(tx, session, stored);
		});
	}
	async act(id: string, sessionId: string, action: CasinoAction, expectedRevision?: number): Promise<SessionView> {
		return this.persistence.unitOfWork.run(async (tx) => {
			await this.queries.lockBag(tx, id);
			const [session] = await this.queries.lockOwnedSession(tx, sessionId, id);
			if (!session) return { status: 'error', text: CASINO_SESSION_NOT_FOUND };
			const stored = session.stateJson as StoredGame;
			if (session.status !== 'active')
				return {
					status: 'ok',
					sessionId,
					game: session.game as InteractiveGame,
					done: true,
					revision: stored.actions.length,
					text: CASINO_SESSION_TEXT.finished(
						replayGame(session.game as InteractiveGame, session.betAmount, stored).text,
						session.payout ?? 0,
					),
				};
			const next = this.clock.now().getTime() >= session.expiresAt.getTime() ? 'timeout' : action;
			if (next !== 'timeout' && expectedRevision !== undefined && expectedRevision !== stored.actions.length)
				return this.resolve(tx, session, stored);
			if (
				next !== 'timeout' &&
				!(session.game === 'blackjack' ? ['hit', 'stand'] : ['push', 'cash']).includes(next)
			)
				return { status: 'error', text: CASINO_SESSION_TEXT.invalidAction };
			stored.actions.push(next);
			return this.resolve(tx, session, stored);
		});
	}
	private async resolve(
		tx: Executor,
		s: typeof activeCasinoSessions.$inferSelect,
		stored: StoredGame,
	): Promise<SessionView> {
		const game = s.game as InteractiveGame;
		const view = replayGame(game, s.betAmount, stored);
		if (!view.done) {
			await this.queries.updateSession(tx, s.sessionId, { stateJson: stored, updatedAt: this.clock.now() });
			return {
				status: 'ok',
				sessionId: s.sessionId,
				game,
				done: false,
				revision: stored.actions.length,
				text: view.text + CASINO_SESSION_TEXT.timeoutHint,
			};
		}
		const [bag] = await this.queries.findBag(tx, s.discordId);
		const after = bag.credux + view.payout;
		await this.queries.updateBag(tx, s.discordId, { credux: after });
		await this.queries.updateSession(tx, s.sessionId, {
			stateJson: stored,
			status: 'settled',
			payout: view.payout,
			balanceAfter: after,
			updatedAt: this.clock.now(),
		});
		await this.queries.insertLog(tx, {
			discordId: s.discordId,
			game,
			betAmount: s.betAmount,
			result: view.result,
			payout: view.payout,
			balanceBefore: s.balanceBefore,
			balanceAfter: after,
			metadata: { sessionId: s.sessionId, actions: stored.actions },
		});
		await this.progress.apply(tx, s.discordId, 'casino', this.clock.now());
		return {
			status: 'ok',
			sessionId: s.sessionId,
			game,
			done: true,
			revision: stored.actions.length,
			text: CASINO_SETTLE_LINE(view.text, view.result, formatNumber(view.payout), formatNumber(after)),
		};
	}
	async recoverExpired(): Promise<void> {
		const expired = await this.queries.findExpiredSessions(this.persistence.executor, this.clock.now());
		for (const s of expired) await this.act(s.discordId, s.sessionId, 'timeout');
	}
}
