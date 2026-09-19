import { newDeck, blackjackValue, isBlackjack, type Card, type Deck } from './CardDeck.js';
import { EVEN_MONEY } from '../../config/casinoPayouts.js';

export type BlackjackOutcome = 'win' | 'loss' | 'push';

export interface BlackjackSessionState {
	bet: number;
	deck: Deck;
	player: Card[];
	dealer: Card[];
	state: 'player' | 'done';
	outcome: BlackjackOutcome | null;
	payout: number;
	revealed: boolean;
}

const DEALER_STANDS_AT = 17;

/**
 * Pure session core, ported 1:1 from casino/blackjack.js. This module
 * owns no Map, touches no DB/Discord, and takes an injectable rng — the
 * ORIGINAL file's own stated design. The command layer (session Map,
 * Hit/Stand buttons, 60s timeout, money path) is standard Discord.js
 * interaction-collector plumbing with no game-specific logic in it, so
 * it's left as a follow-up rather than built here — see README.
 */
export class BlackjackSession {
	static create(bet: number, rng: () => number): BlackjackSessionState {
		const deck = newDeck(rng);
		const s: BlackjackSessionState = {
			bet,
			deck,
			player: [deck.draw(), deck.draw()],
			dealer: [deck.draw(), deck.draw()], // dealer[1] is the hole card
			state: 'player',
			outcome: null,
			payout: 0,
			revealed: false,
		};
		if (isBlackjack(s.player) || isBlackjack(s.dealer)) BlackjackSession.finish(s);
		return s;
	}

	static playerValue(s: BlackjackSessionState): number {
		return blackjackValue(s.player);
	}

	static dealerValue(s: BlackjackSessionState): number {
		return blackjackValue(s.dealer);
	}

	/** Auto-resolves on 21 (stand) or bust. */
	static hit(s: BlackjackSessionState): BlackjackSessionState {
		if (s.state !== 'player') return s;
		s.player.push(s.deck.draw());
		if (blackjackValue(s.player) >= 21) BlackjackSession.finish(s);
		return s;
	}

	static stand(s: BlackjackSessionState): BlackjackSessionState {
		if (s.state !== 'player') return s;
		BlackjackSession.finish(s);
		return s;
	}

	private static finish(s: BlackjackSessionState): void {
		s.revealed = true;
		const pv = blackjackValue(s.player);
		const openingNatural = isBlackjack(s.player) || isBlackjack(s.dealer);
		if (pv <= 21 && !openingNatural) {
			while (blackjackValue(s.dealer) < DEALER_STANDS_AT) s.dealer.push(s.deck.draw());
		}
		const dv = blackjackValue(s.dealer);

		let outcome: BlackjackOutcome;
		if (pv > 21) outcome = 'loss';
		else if (dv > 21) outcome = 'win';
		else if (pv > dv) outcome = 'win';
		else if (pv < dv) outcome = 'loss';
		else outcome = 'push';

		s.state = 'done';
		s.outcome = outcome;
		let payout = 0;
		if (outcome === 'win') payout = Math.floor(s.bet * EVEN_MONEY);
		else if (outcome === 'push') payout = s.bet;
		s.payout = payout;
	}
}
