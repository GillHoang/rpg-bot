import { AppError, ok, type Result } from '../../../shared/kernel/Result.js';
import type { UseCase } from '../../../shared/kernel/UseCase.js';
import { ECONOMY_MODULE_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import type { PlayerAccount } from '../../identity/domain/PlayerAccount.js';
import type { BagQueryPort, BalanceQueryPort } from './ports.js';

export interface GetBalanceInput {
	discordId: string;
}

export interface BalanceView {
	username: string;
	credux: number;
	beliefShards: number;
	bag: Awaited<ReturnType<BagQueryPort['bag']>>;
}

export class GetBalanceUseCase implements UseCase<GetBalanceInput, BalanceView | null> {
	constructor(
		private readonly economy: BalanceQueryPort,
		private readonly inventory: BagQueryPort,
	) {}

	async execute(input: GetBalanceInput): Promise<Result<BalanceView | null, AppError>> {
		if (!input.discordId) {
			return {
				ok: false,
				error: new AppError('VALIDATION_EMPTY_DISCORD_ID', ECONOMY_MODULE_ERROR_TEXT.emptyDiscordId),
			};
		}
		const account: PlayerAccount | null = await this.economy.getAccount(input.discordId);
		if (!account) return ok(null);
		const bag = await this.inventory.bag(input.discordId);
		return ok({ username: account.username, credux: account.credux, beliefShards: account.beliefShards, bag });
	}
}
