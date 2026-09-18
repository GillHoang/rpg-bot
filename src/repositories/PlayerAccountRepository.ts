import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { users, userCharacter, usersBag } from '../db/schema.js';
import { PlayerAccount, type CombatClass } from '../domain/entities/PlayerAccount.js';
import type { Repository } from './Repository.js';

/**
 * Repository pattern: the only place in the codebase allowed to write
 * drizzle queries against `users` / `user_character` / `users_bag`.
 * Services and commands only ever talk to PlayerAccount objects.
 */
export class PlayerAccountRepository implements Repository<PlayerAccount, string> {
	async findById(discordId: string): Promise<PlayerAccount | null> {
		return this.findByIdWithExecutor(db, discordId);
	}

	async findByIdWithExecutor(executor: Executor, discordId: string): Promise<PlayerAccount | null> {
		const [user] = await executor.select().from(users).where(eq(users.discordId, discordId)).limit(1);
		if (!user) return null;

		const [character] = await executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1);

		const [bag] = await executor.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);

		return new PlayerAccount(
			user.discordId,
			user.username,
			character?.combatLevel ?? 1,
			character?.combatExp ?? 0,
			(character?.class as CombatClass) ?? 'Swordsman',
			bag?.credux ?? 0,
			bag?.beliefShards ?? 0,
		);
	}

	// Account creation is a two-step, multi-table flow with its own guard
	// rules (register -> create character, with a starter-gear grant in
	// between) — see RegistrationService / CharacterCreationService, which
	// own those transactions. This repository only reads/updates the
	// already-created account.

	async saveCredux(account: PlayerAccount): Promise<void> {
		await this.saveCreduxWithExecutor(db, account);
	}

	async saveCreduxWithExecutor(executor: Executor, account: PlayerAccount): Promise<void> {
		await executor.update(usersBag).set({ credux: account.credux }).where(eq(usersBag.discordId, account.discordId));
	}
}
