import { BlackjackSession } from './BlackjackSession.js';
import { CrashSession } from './CrashSession.js';
import { createRng } from '../combat/Rng.js';
import { CASINO_BLACKJACK_VIEW, CASINO_CRASH_VIEW, CASINO_HIDDEN_CARD } from '../../text/casino.js';
export type InteractiveGame = 'blackjack' | 'crash';
export type CasinoAction = 'hit' | 'stand' | 'push' | 'cash' | 'timeout';
export interface StoredGame {
	seed: number;
	actions: CasinoAction[];
}

/** Replay the small action history from a secret, server-side seed after every click. */
export function replayGame(game: InteractiveGame, bet: number, stored: StoredGame) {
	return game === 'blackjack' ? replayBlackjack(bet, stored) : replayCrash(bet, stored);
}

function replayBlackjack(bet: number, stored: StoredGame) {
	const rng = createRng(stored.seed);
	const s = BlackjackSession.create(bet, rng);
	for (const action of stored.actions) {
		if (action === 'hit') BlackjackSession.hit(s);
		else if (action === 'stand' || action === 'timeout') BlackjackSession.stand(s);
	}
	const hand = (cards: typeof s.player) => cards.map((c) => `${c.rank.toUpperCase()}-${c.suit}`).join(' ');
	return {
		done: s.state === 'done',
		payout: s.payout,
		result: s.outcome ?? 'active',
		text: CASINO_BLACKJACK_VIEW(
			bet.toLocaleString(),
			`${hand(s.player)} (${BlackjackSession.playerValue(s)})`,
			s.revealed
				? `${hand(s.dealer)} (${BlackjackSession.dealerValue(s)})`
				: `${hand([s.dealer[0]])} ${CASINO_HIDDEN_CARD}`,
		),
	};
}

function replayCrash(bet: number, stored: StoredGame) {
	const rng = createRng(stored.seed);
	const s = CrashSession.create(bet);
	for (const action of stored.actions) {
		if (action === 'push') {
			const r = CrashSession.pushNext(s, rng);
			if (r.maxed) CrashSession.cashOut(s);
		} else if (action === 'cash' || action === 'timeout') CrashSession.cashOut(s);
	}
	let result: 'win' | 'loss' | 'push' | 'active' = 'active';
	if (s.state === 'crashed') result = 'loss';
	else if (s.state === 'cashed') result = s.payout > bet ? 'win' : 'push';
	return {
		done: s.state !== 'active',
		payout: s.payout,
		result,
		text: CASINO_CRASH_VIEW(bet.toLocaleString(), s.push, s.multiplier.toFixed(2), s.state),
	};
}
