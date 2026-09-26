import { and, desc, eq, sql } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { autoRaids, bossAttackLog, bossSpawnQueue, bossState, userGuildActivity, usersBag } from '../../../db/schema.js';

/** Named persistence operations for the guild World Boss (see WorldBossService). */
export class WorldBossRepository {
	async findBoss(tx: Executor, guildId: string) {
		return tx.select().from(bossState).where(eq(bossState.guildId, guildId)).for('update');
	}

	async insertBoss(tx: Executor, values: typeof bossState.$inferInsert) {
		return tx.insert(bossState).values(values);
	}

	async updateBoss(tx: Executor, guildId: string, values: Partial<typeof bossState.$inferInsert>) {
		return tx.update(bossState).set(values).where(eq(bossState.guildId, guildId));
	}

	async findAttack(tx: Executor, spawnId: string, discordId: string) {
		return tx
			.select()
			.from(bossAttackLog)
			.where(and(eq(bossAttackLog.bossSpawnId, spawnId), eq(bossAttackLog.discordId, discordId)))
			.for('update');
	}

	async upsertAttack(
		tx: Executor,
		values: typeof bossAttackLog.$inferInsert,
		damage: number,
		dailyAttacks: number,
		day: string,
	) {
		return tx
			.insert(bossAttackLog)
			.values({ ...values, totalDamage: damage, dailyAttacks, lastDailyReset: day })
			.onConflictDoUpdate({
				target: [bossAttackLog.bossSpawnId, bossAttackLog.discordId],
				set: {
					totalDamage: sql`${bossAttackLog.totalDamage} + ${damage}`,
					dailyAttacks,
					lastDailyReset: day,
					attackedAt: values.attackedAt,
				},
			});
	}

	async topAttackers(tx: Executor, spawnId: string, limit: number) {
		return tx
			.select()
			.from(bossAttackLog)
			.where(eq(bossAttackLog.bossSpawnId, spawnId))
			.orderBy(desc(bossAttackLog.totalDamage))
			.limit(limit);
	}

	async countAttackers(tx: Executor, spawnId: string): Promise<number> {
		const rows = await tx
			.select({ discordId: bossAttackLog.discordId })
			.from(bossAttackLog)
			.where(eq(bossAttackLog.bossSpawnId, spawnId));
		return rows.length;
	}

	async recordSpawn(tx: Executor, values: typeof bossSpawnQueue.$inferInsert) {
		return tx.insert(bossSpawnQueue).values(values);
	}

	async findAuto(tx: Executor, discordId: string) {
		return tx.select().from(autoRaids).where(eq(autoRaids.discordId, discordId));
	}

	/** Phase 5 Guild War: every World Boss attack marks the player active in that guild. */
	async touchActivity(tx: Executor, discordId: string, guildId: string, now: Date) {
		return tx
			.insert(userGuildActivity)
			.values({ discordId, guildId, lastActive: now })
			.onConflictDoUpdate({
				target: [userGuildActivity.discordId, userGuildActivity.guildId],
				set: { lastActive: now },
			});
	}

	/** Cross-guild damage race (one row per guild with any contribution). */
	async guildWarBoard(tx: Executor, limit: number) {
		return tx
			.select({
				guildId: bossAttackLog.guildId,
				totalDamage: sql<number>`sum(${bossAttackLog.totalDamage})::int`,
				attackers: sql<number>`count(distinct ${bossAttackLog.discordId})::int`,
			})
			.from(bossAttackLog)
			.groupBy(bossAttackLog.guildId)
			.orderBy(sql`sum(${bossAttackLog.totalDamage}) desc`)
			.limit(limit);
	}

	async upsertAuto(tx: Executor, values: typeof autoRaids.$inferInsert) {
		return tx
			.insert(autoRaids)
			.values(values)
			.onConflictDoUpdate({
				target: autoRaids.discordId,
				set: { endsAt: values.endsAt, combatLevel: values.combatLevel },
			});
	}

	/** Increment a participant's purse without a prior lock (single-row PK write). */
	async grantPurse(
		tx: Executor,
		discordId: string,
		credux: number,
		chest: 'supremeChest' | 'bossGoldenChest' | 'bossTreasureChest' | null,
	) {
		const set: Partial<typeof usersBag.$inferInsert> = {
			credux: sql`${usersBag.credux} + ${credux}` as unknown as number,
			lifetimeCreduxEarned: sql`${usersBag.lifetimeCreduxEarned} + ${credux}` as unknown as number,
		};
		if (chest) set[chest] = sql`${usersBag[chest]} + 1` as unknown as number;
		return tx.update(usersBag).set(set).where(eq(usersBag.discordId, discordId));
	}
}
