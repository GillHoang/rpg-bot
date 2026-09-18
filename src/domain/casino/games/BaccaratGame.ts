import type { ICasinoGame, CasinoOutcome } from '../ICasinoGame.js';
import { EVEN_MONEY } from '../../../config/casinoPayouts.js';
import { newDeck, baccaratValue, baccaratScore, type Card } from '../CardDeck.js';

/**
 * Standard punto banco, ported 1:1 from casino/baccarat.js:
 *  - 2 cards each; a natural (either hand 8 or 9 on the first two) stands.
 *  - else PLAYER draws a third on 0-5, stands 6-7.
 *  - else BANKER draws per the standard third-card matrix (vs the
 *    player's third-card value, evaluated against the banker's
 *    ORIGINAL two-card score).
 * No commission (virtual economy). Player/Banker win -> 2x. Tie -> push
 * (stake returned) regardless of the player's pick.
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

			let bankerDraws: boolean;
			if (playerThirdVal === null) {
				bankerDraws = bTwo <= 5;
			} else {
				const pt = playerThirdVal;
				if (bTwo <= 2) bankerDraws = true;
				else if (bTwo === 3) bankerDraws = pt !== 8;
				else if (bTwo === 4) bankerDraws = pt >= 2 && pt <= 7;
				else if (bTwo === 5) bankerDraws = pt >= 4 && pt <= 7;
				else if (bTwo === 6) bankerDraws = pt >= 6 && pt <= 7;
				else bankerDraws = false;
			}
			if (bankerDraws) banker.push(deck.draw());
		}

		const pScore = baccaratScore(player);
		const bScore = baccaratScore(banker);
		const winner = pScore > bScore ? 'player' : bScore > pScore ? 'banker' : 'tie';
		const push = winner === 'tie';
		const won = !push && winner === pick;

		return {
			won,
			payout: push ? bet : won ? Math.floor(bet * EVEN_MONEY) : 0,
			result: winner,
			metadata: { player, banker, pScore, bScore, pick, push },
		};
	}
}
