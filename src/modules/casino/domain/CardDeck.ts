import { CARD_DECK_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { AppError } from '../../../shared/kernel/Result.js';
import { RandomPicker } from '../../../shared/utils/weightedRandom.js';
export type Suit = 'pegasus' | 'trident' | 'laurel' | 'hammer';
export type Rank = 'a' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'j' | 'q' | 'k';
export interface Card {
	suit: Suit;
	rank: Rank;
}

const SUITS: readonly Suit[] = ['pegasus', 'trident', 'laurel', 'hammer'];
const RANKS: readonly Rank[] = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];

export interface Deck {
	draw(): Card;
	remaining(): number;
}

/**
 * One 52-card deck per round, dealt WITHOUT replacement — matches the
 * v4.7 fix in cardDeck.js (independent-draw could duplicate a card
 * within one hand; a single shared deck per round cannot).
 */
export function newDeck(rng: () => number): Deck {
	const cards: Card[] = [];
	for (const suit of SUITS) for (const rank of RANKS) cards.push({ suit, rank });
	const picker = new RandomPicker(
		cards.map((original) => ({ original, weight: 1 })),
		{ next: rng, removeOnPick: true },
	);
	let remaining = cards.length;
	return {
		draw(): Card {
			if (remaining === 0) throw new AppError('CARD_DECK_EXHAUSTED', CARD_DECK_ERROR_TEXT.exhausted);
			const card = picker.pick();
			remaining--;
			return card;
		},
		remaining(): number {
			return remaining;
		},
	};
}

/** Baccarat point value: A=1, 2-9 pip, 10/J/Q/K=0. */
export function baccaratValue(rank: Rank): number {
	if (rank === 'a') return 1;
	if (rank === 'j' || rank === 'q' || rank === 'k' || rank === '10') return 0;
	return Number(rank);
}

/** Baccarat hand score: sum of values mod 10. */
export function baccaratScore(hand: Card[]): number {
	return hand.reduce((s, c) => s + baccaratValue(c.rank), 0) % 10;
}

function blackjackPip(rank: Rank): number {
	if (rank === 'a') return 1;
	if (rank === 'j' || rank === 'q' || rank === 'k') return 10;
	return Number(rank);
}

/** Best blackjack hand value — one Ace may count as 11 when it doesn't bust. */
export function blackjackValue(hand: Card[]): number {
	let total = 0;
	let aces = 0;
	for (const c of hand) {
		total += blackjackPip(c.rank);
		if (c.rank === 'a') aces += 1;
	}
	while (aces > 0 && total + 10 <= 21) {
		total += 10;
		aces -= 1;
	}
	return total;
}

/** A natural blackjack is exactly 21 on the opening two cards. */
export function isBlackjack(hand: Card[]): boolean {
	return hand.length === 2 && blackjackValue(hand) === 21;
}
