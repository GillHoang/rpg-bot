import type { ICasinoGame, CasinoOutcome } from '../ICasinoGame.js';
import { BANKER_PAYOUT_MULT, EVEN_MONEY } from '../../../../shared/config/casinoPayouts.js';
import { newDeck, baccaratValue, baccaratScore, type Card } from '../CardDeck.js';

/**
 * Banker's third-card rule, evaluated against the banker's ORIGINAL two-card
 * score and the player's third-card value (null when the player stood).
 * Ported 1:1 from casino/baccarat.js.
 */
function bankerDrawsThird(bTwo: number, playerThirdVal: number | null): boolean {
	if (playerThirdVal === null) return bTwo <= 5;
	const pt = playerThirdVal;
	if (bTwo <= 2) return true;
	if (bTwo === 3) return pt !== 8;
	if (bTwo === 4) return pt >= 2 && pt <= 7;
	if (bTwo === 5) return pt >= 4 && pt <= 7;
	if (bTwo === 6) return pt >= 6 && pt <= 7;
	return false;
}

/**
 * Standard punto banco, ported 1:1 from casino/baccarat.js:
 *  - 2 cards each; a natural (either hand 8 or 9 on the first two) stands.
 *  - else PLAYER draws a third on 0-5, stands 6-7.
 *  - else BANKER draws per the standard third-card matrix (vs the
 *    player's third-card value, evaluated against the banker's
 *    ORIGINAL two-card score).
 *  * No commission on player wins (2x gross). Banker wins pay 1.95x gross
 *    (standard 5% commission) — without it the banker side is +EV ~+1.24%.
 * Tie -> push (stake returned) regardless of the player's pick.
 */
export class BaccaratGame implements ICasinoGame {
	readonly key = 'baccarat';

	play(bet: number, rng: () => number, choice?: string): CasinoOutcome {
		const pick = choice === 'banker' ? 'banker' : 'player';
		const deck = newDeck(rng);
		const player: Card[] = [deck.draw(), deck.draw()];
		const banker: Card[] = [deck.draw(), deck.draw()];

		const pTwo = baccaratScore(player);
		const bTwo = baccaratScore(banker);
		const natural = pTwo >= 8 || bTwo >= 8;

		let playerThirdVal: number | null = null;

		if (!natural) {
			if (pTwo <= 5) {
				const c = deck.draw();
				player.push(c);
				playerThirdVal = baccaratValue(c.rank);
			}
			if (bankerDrawsThird(bTwo, playerThirdVal)) banker.push(deck.draw());
		}

		const pScore = baccaratScore(player);
		const bScore = baccaratScore(banker);
		let winner: 'player' | 'banker' | 'tie';
		if (pScore > bScore) winner = 'player';
		else if (bScore > pScore) winner = 'banker';
		else winner = 'tie';
		const push = winner === 'tie';
		const won = !push && winner === pick;

		let payout = 0;
		if (push) payout = bet;
		else if (won) payout = Math.floor(bet * (pick === 'banker' ? BANKER_PAYOUT_MULT : EVEN_MONEY));
		return {
			won,
			payout,
			result: winner,
			metadata: { player, banker, pScore, bScore, pick, push },
		};
	}
}
