import { db } from '../db/client.js';
import { UserRepository } from '../repositories/UserRepository.js';

export type RegistrationResult = { status: 'ok' } | { status: 'already-registered' };

/**
 * Facade over UserRepository — the transaction boundary lives here, not in
 * the command handler. Ported from commands/rpg/register.js's handleConfirm
 * (minus the ban check, which belongs to a future middleware/interceptor
 * layer, and minus the button-confirmation UI step).
 */
export class RegistrationService {
	constructor(private readonly users = new UserRepository()) {}

	async register(discordId: string, username: string): Promise<RegistrationResult> {
		return db.transaction(async (tx): Promise<RegistrationResult> => {
			if (await this.users.isRegistered(tx, discordId)) {
				return { status: 'already-registered' };
			}
			await this.users.registerNew(tx, discordId, username);
			return { status: 'ok' };
		});
	}
}
