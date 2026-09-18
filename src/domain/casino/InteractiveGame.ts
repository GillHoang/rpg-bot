import { BlackjackSession } from './BlackjackSession.js';
import { CrashSession } from './CrashSession.js';
import { createRng } from '../combat/Rng.js';
export type InteractiveGame = 'blackjack' | 'crash';
export type CasinoAction = 'hit' | 'stand' | 'push' | 'cash' | 'timeout';
export interface StoredGame {
	seed: number;
	actions: CasinoAction[];
}

/** Replay the small action history from a secret, server-side seed after every click. */
export function replayGame(game: InteractiveGame, bet: number, stored: StoredGame) {
	const rng = createRng(stored.seed);
	if (game === 'blackjack') {
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
			text: `Blackjack · Cược ${bet.toLocaleString()}\nBạn: ${hand(s.player)} (${BlackjackSession.playerValue(s)})\nDealer: ${s.revealed ? `${hand(s.dealer)} (${BlackjackSession.dealerValue(s)})` : `${hand([s.dealer[0]])} [ẩn]`}`,
		};
	}
	const s = CrashSession.create(bet);
	for (const action of stored.actions) {
		if (action === 'push') {
			const r = CrashSession.pushNext(s, rng);
			if (r.maxed) CrashSession.cashOut(s);
		} else if (action === 'cash' || action === 'timeout') CrashSession.cashOut(s);
	}
	return {
		done: s.state !== 'active',
		payout: s.payout,
		result: s.state === 'crashed' ? 'loss' : s.state === 'cashed' ? (s.payout > bet ? 'win' : 'push') : 'active',
		text: `Crash · Cược ${bet.toLocaleString()}\nLượt ${s.push} · Hệ số ${s.multiplier.toFixed(2)}x · ${s.state}`,
	};
}
