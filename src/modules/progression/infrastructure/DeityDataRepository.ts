import { eq, and } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { deityRoster, userDeities } from '../../../db/schema.js';
import type { DeityTier } from '../../../shared/config/gachaRates.js';

export interface DeityRosterRow {
	deityId: number;
	name: string;
	mythology: string;
	baseHp: number;
	baseAtk: number;
	baseDef: number;
	blessingName: string;
}

export interface OwnedDeityProgress {
	userDeityId: number;
	deityId: number;
	name: string;
	tier: DeityTier;
	sigils: number;
	ascended: boolean;
	baseAtk: number;
	baseHp: number;
	baseDef: number;
}

export class DeityDataRepository {
	async listAvailableForTier(executor: Executor, tier: DeityTier): Promise<DeityRosterRow[]> {
		const rows = await executor
			.select()
			.from(deityRoster)
			.where(and(eq(deityRoster.tier, tier), eq(deityRoster.isAvailable, true)))
			.orderBy(deityRoster.deityId);
		return rows;
	}

	async ownedDeityIds(executor: Executor, discordId: string): Promise<Set<number>> {
		const rows = await executor
			.select({ deityId: userDeities.deityId })
			.from(userDeities)
			.where(eq(userDeities.discordId, discordId));
		return new Set(rows.map((r: { deityId: number }) => r.deityId));
	}

	/** Raw data for service-owned Sigil scaling and stat assembly. */
	async findAssemblyData(
		executor: Executor,
		userDeityId: number,
	): Promise<{
		baseAtk: number;
		baseHp: number;
		baseDef: number;
		mythology: string;
		blessingKey: string;
		blessingScaling: string;
		sigils: number;
	} | null> {
		const [row] = await executor
			.select({
				sigils: userDeities.sigils,
				baseAtk: deityRoster.baseAtk,
				baseHp: deityRoster.baseHp,
				baseDef: deityRoster.baseDef,
				mythology: deityRoster.mythology,
				blessingKey: deityRoster.blessingKey,
				blessingScaling: deityRoster.blessingScaling,
			})
			.from(userDeities)
			.innerJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
			.where(eq(userDeities.userDeityId, userDeityId))
			.limit(1);
		return row ?? null;
	}

	async findOwnedProgress(
		executor: Executor,
		discordId: string,
		userDeityId: number,
	): Promise<OwnedDeityProgress | null> {
		const [row] = await executor
			.select({
				userDeityId: userDeities.userDeityId,
				deityId: userDeities.deityId,
				sigils: userDeities.sigils,
				ascended: userDeities.ascended,
				name: deityRoster.name,
				tier: deityRoster.tier,
				baseAtk: deityRoster.baseAtk,
				baseHp: deityRoster.baseHp,
				baseDef: deityRoster.baseDef,
			})
			.from(userDeities)
			.innerJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
			.where(and(eq(userDeities.discordId, discordId), eq(userDeities.userDeityId, userDeityId)))
			.limit(1);
		if (!row) return null;
		return { ...row, tier: row.tier as DeityTier };
	}

	async setSigils(executor: Executor, userDeityId: number, sigils: number): Promise<void> {
		await executor.update(userDeities).set({ sigils }).where(eq(userDeities.userDeityId, userDeityId));
	}

	async setAscended(executor: Executor, userDeityId: number): Promise<void> {
		await executor.update(userDeities).set({ ascended: true }).where(eq(userDeities.userDeityId, userDeityId));
	}

	async insertNew(executor: Executor, entry: typeof userDeities.$inferInsert): Promise<number> {
		const [row] = await executor
			.insert(userDeities)
			.values(entry)
			.returning({ userDeityId: userDeities.userDeityId });
		return row.userDeityId;
	}
}
