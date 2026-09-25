import type { Executor } from '../../../db/client.js';
import { and, desc, eq } from 'drizzle-orm';
import { huntCooldowns, raidLogs, users, usersBag, userCharacter, menuActionReceipts } from '../../../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class RaidRepository {
	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}

	async lockCharacter(tx: Executor, discordId: string) {
		return tx.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).for('update');
	}

	async findReceipt(tx: Executor, discordId: string, requestId: string) {
		return tx
			.select()
			.from(menuActionReceipts)
			.where(and(eq(menuActionReceipts.discordId, discordId), eq(menuActionReceipts.requestId, requestId)));
	}

	async insertReceipt(tx: Executor, values: typeof menuActionReceipts.$inferInsert) {
		return tx.insert(menuActionReceipts).values(values);
	}

	async lockHuntCooldown(tx: Executor, discordId: string) {
		return tx.select().from(huntCooldowns).where(eq(huntCooldowns.discordId, discordId)).for('update');
	}

	async upsertHuntCooldown(tx: Executor, discordId: string, readyAt: Date) {
		return tx
			.insert(huntCooldowns)
			.values({ discordId, readyAt })
			.onConflictDoUpdate({ target: huntCooldowns.discordId, set: { readyAt } });
	}

	async updateCharacter(tx: Executor, discordId: string, values: Partial<typeof userCharacter.$inferInsert>) {
		return tx.update(userCharacter).set(values).where(eq(userCharacter.discordId, discordId));
	}

	async lockUser(tx: Executor, discordId: string) {
		return tx.select().from(users).where(eq(users.discordId, discordId)).for('update');
	}

	/** Latest boss attempt (win or loss) — backs the rolling test-server cooldown. */
	async findLastBossAttack(tx: Executor, discordId: string): Promise<Date | null> {
		const [row] = await tx
			.select({ timestamp: raidLogs.timestamp })
			.from(raidLogs)
			.where(and(eq(raidLogs.discordId, discordId), eq(raidLogs.battleType, 'boss')))
			.orderBy(desc(raidLogs.id))
			.limit(1);
		return row?.timestamp ?? null;
	}

	async updateUser(tx: Executor, discordId: string, values: Partial<typeof users.$inferInsert>) {
		return tx.update(users).set(values).where(eq(users.discordId, discordId));
	}

	async updateBag(tx: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return tx.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}
}
