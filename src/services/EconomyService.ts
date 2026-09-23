import { ECONOMY_ERROR_TEXT } from '../text/diagnostics.js';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';

import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { EventBus } from '../core/EventBus.js';
import type { PlayerAccount } from '../domain/entities/PlayerAccount.js';

export interface EconomyDependencies {
	persistence?: PersistenceContext;
}

/**
 * Facade: commands call one clean method (`getOrCreateAccount`,
 * `grantCurrency`) instead of orchestrating repository + event bus
 * themselves. Keeps command classes thin — their job is Discord I/O,
 * not business logic.
 */

export class EconomyService {
	private readonly persistence: PersistenceContext;
	private readonly accounts: Pick<
		PlayerAccountRepository,
		'findById' | 'findByIdWithExecutor' | 'saveCreduxWithExecutor'
	>;
	private readonly events: Pick<EventBus, 'emit'>;
	constructor(
		accounts:
			| Pick<PlayerAccountRepository, 'findById' | 'findByIdWithExecutor' | 'saveCreduxWithExecutor'>
			| undefined = undefined,
		events: Pick<EventBus, 'emit'> | undefined = undefined,
		options: EconomyDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.accounts = accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.events = events ?? EventBus.getInstance();
	}

	async getAccount(discordId: string): Promise<PlayerAccount | null> {
		return this.accounts.findById(discordId);
	}

	async grantCurrency(discordId: string, amount: number, source: string): Promise<PlayerAccount> {
		// Read-modify-write must be one transaction or concurrent grants lose
		// updates. `earn()` itself rejects amount <= 0 / non-integer.
		const account = await this.persistence.unitOfWork.run(async (tx) => {
			const acc = await this.accounts.findByIdWithExecutor(tx, discordId);
			if (!acc) throw new Error(ECONOMY_ERROR_TEXT.missingAccount(discordId));
			acc.earn(amount);
			await this.accounts.saveCreduxWithExecutor(tx, acc);
			return acc;
		});
		this.events.emit('currency.earned', { discordId, currency: 'credux', amount, source });
		return account;
	}
}
