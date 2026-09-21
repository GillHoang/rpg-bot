import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { users, userCharacter, usersBag } from '../db/schema.js';
import { PlayerAccount, type CombatClass } from '../domain/entities/PlayerAccount.js';
import type { Repository } from './Repository.js';

/**
 * Maps persisted account state to the domain entity. The supplied executor
 * keeps standalone reads and explicit transaction reads independently testable.
 */
export class PlayerAccountRepository implements Repository<PlayerAccount, string> {
	constructor(private readonly executor: Executor = db) {}

	async findById(discordId: string): Promise<PlayerAccount | null> {
		return this.findByIdWithExecutor(this.executor, discordId);
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

	// Account creation is a multi-table flow with its own guard rules —
	// see StartService, which owns that transaction. This repository only
	// reads/updates the already-created account.

	async saveCredux(account: PlayerAccount): Promise<void> {
		await this.saveCreduxWithExecutor(this.executor, account);
	}

	async saveCreduxWithExecutor(executor: Executor, account: PlayerAccount): Promise<void> {
		await executor
			.update(usersBag)
			.set({ credux: account.credux })
			.where(eq(usersBag.discordId, account.discordId));
	}
}
