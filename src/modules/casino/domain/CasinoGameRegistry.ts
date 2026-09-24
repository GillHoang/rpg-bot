import type { ICasinoGame } from './ICasinoGame.js';
import { CoinTossGame } from './games/CoinTossGame.js';
import { DiceRollGame } from './games/DiceRollGame.js';
import { SlotMachineGame } from './games/SlotMachineGame.js';
import { BaccaratGame } from './games/BaccaratGame.js';

export type StatelessCasinoGameKey = 'coin_toss' | 'dice_roll' | 'slot_machine' | 'baccarat';

/**
 * Factory: only the 4 one-shot games (Strategy pattern, ICasinoGame).
 * Blackjack/Crash are genuinely stateful across turns and are modeled as
 * their own Session classes instead — see README M6 section for why
 * they're not registered here.
 */
export class CasinoGameRegistry {
	private static readonly games: Record<StatelessCasinoGameKey, ICasinoGame> = {
		coin_toss: new CoinTossGame(),
		dice_roll: new DiceRollGame(),
		slot_machine: new SlotMachineGame(),
		baccarat: new BaccaratGame(),
	};

	static get(key: StatelessCasinoGameKey): ICasinoGame {
		return CasinoGameRegistry.games[key];
	}
}
