import { db } from '../db/client.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { EventBus } from '../core/EventBus.js';
import type { PlayerAccount } from '../domain/entities/PlayerAccount.js';

/**
 * Facade: commands call one clean method (`getOrCreateAccount`,
 * `grantCurrency`) instead of orchestrating repository + event bus
 * themselves. Keeps command classes thin — their job is Discord I/O,
 * not business logic.
 */
export class EconomyService {
	constructor(
		private readonly accounts = new PlayerAccountRepository(),
		private readonly events = EventBus.getInstance(),
	) {}

	async getAccount(discordId: string): Promise<PlayerAccount | null> {
		return this.accounts.findById(discordId);
	}

	async grantCurrency(discordId: string, amount: number, source: string): Promise<PlayerAccount> {
		// Read-modify-write must be one transaction or concurrent grants lose
		// updates. `earn()` itself rejects amount <= 0 / non-integer.
		const account = await db.transaction(async (tx) => {
			const acc = await this.accounts.findByIdWithExecutor(tx, discordId);
			if (!acc) throw new Error(`No account for ${discordId}; register first`);
			acc.earn(amount);
			await this.accounts.saveCreduxWithExecutor(tx, acc);
			return acc;
		});
		this.events.emit('currency.earned', { discordId, currency: 'credux', amount, source });
		return account;
	}
}
