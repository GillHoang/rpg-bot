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

	register(discordId: string, username: string): RegistrationResult {
		return db.transaction((tx): RegistrationResult => {
			if (this.users.isRegistered(tx, discordId)) {
				return { status: 'already-registered' };
			}
			this.users.registerNew(tx, discordId, username);
			return { status: 'ok' };
		});
	}
}
