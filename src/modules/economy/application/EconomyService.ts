import { ACCOUNT_ERROR_TEXT, ECONOMY_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { AppError } from '../../../shared/kernel/Result.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';

import { PlayerAccountRepository } from '../../identity/infrastructure/PlayerAccountRepository.js';
import { EMIT_ONLY_EVENT_BUS, type EventBus } from '../../../shared/kernel/EventBus.js';
import type { PlayerAccount } from '../../identity/domain/PlayerAccount.js';

export interface EconomyDependencies {
	persistence: PersistenceContext;
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
		'findById' | 'findByIdWithExecutor' | 'saveCreduxWithExecutor' | 'addCreduxWithExecutor'
	>;
	private readonly events: Pick<EventBus, 'emit'>;
	constructor(
		accounts?: Pick<
			PlayerAccountRepository,
			'findById' | 'findByIdWithExecutor' | 'saveCreduxWithExecutor' | 'addCreduxWithExecutor'
		>,
		events?: Pick<EventBus, 'emit'>,
		options: EconomyDependencies = {} as EconomyDependencies,
	) {
		this.persistence = requirePersistence(options, 'EconomyService');
		this.accounts = accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.events = events ?? EMIT_ONLY_EVENT_BUS;
	}

	async getAccount(discordId: string): Promise<PlayerAccount | null> {
		return this.accounts.findById(discordId);
	}

	async grantCurrency(discordId: string, amount: number, source: string): Promise<PlayerAccount> {
		// Domain validation first (same rule as PlayerAccount.earn, fail fast
		// without I/O), then a single atomic increment — concurrent grants can
		// never lost-update each other, with or without an explicit row lock.
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new AppError('ACCOUNT_INVALID_EARNING', ACCOUNT_ERROR_TEXT.invalidEarning(amount));
		}
		const account = await this.persistence.unitOfWork.run(async (tx) => {
			const acc = await this.accounts.findByIdWithExecutor(tx, discordId);
			if (!acc) throw new AppError('ECONOMY_MISSING_ACCOUNT', ECONOMY_ERROR_TEXT.missingAccount(discordId));
			const updated = await this.accounts.addCreduxWithExecutor(tx, discordId, amount);
			if (updated == null)
				throw new AppError('ECONOMY_MISSING_ACCOUNT', ECONOMY_ERROR_TEXT.missingAccount(discordId));
			acc.credux = updated;
			return acc;
		});
		this.events.emit('currency.earned', { discordId, currency: 'credux', amount, source });
		return account;
	}
}
