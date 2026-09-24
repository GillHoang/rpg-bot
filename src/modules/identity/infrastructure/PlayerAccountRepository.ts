import { eq, sql } from 'drizzle-orm';
import { type Executor } from '../../../db/client.js';
import { users, userCharacter, usersBag } from '../../../db/schema.js';
import { PlayerAccount, type CombatClass } from '../domain/PlayerAccount.js';
import type { Repository } from '../../../shared/kernel/repository.js';

/**
 * Maps persisted account state to the domain entity. The supplied executor
 * keeps standalone reads and explicit transaction reads independently testable.
 */
export class PlayerAccountRepository implements Repository<PlayerAccount, string> {
	constructor(private readonly executor: Executor) {}

	async findById(discordId: string, executor: Executor = this.executor): Promise<PlayerAccount | null> {
		return this.findByIdWithExecutor(executor, discordId);
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

	async saveCreduxWithExecutor(executor: Executor, account: PlayerAccount): Promise<void> {
		await executor
			.update(usersBag)
			.set({ credux: account.credux })
			.where(eq(usersBag.discordId, account.discordId));
	}

	/**
	 * Atomic credit: increments in a single statement (with the new balance
	 * RETURNED) so concurrent grants can never lost-update each other, no
	 * row lock required. Returns null when the bag row does not exist.
	 */
	async addCreduxWithExecutor(executor: Executor, discordId: string, amount: number): Promise<number | null> {
		const [row] = await executor
			.update(usersBag)
			.set({ credux: sql`${usersBag.credux} + ${amount}` })
			.where(eq(usersBag.discordId, discordId))
			.returning({ credux: usersBag.credux });
		return row?.credux ?? null;
	}
}
