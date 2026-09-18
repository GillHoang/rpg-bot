import { eq, and, sql } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { deityRoster, userDeities } from '../db/schema.js';
import type { DeityTier } from '../config/gachaRates.js';
import { computeSigilStats } from '../config/ascension.js';

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

export class DeityRepository {
	/** Uniform-random pick among available deities of one tier (matches the original's equal-weight pickRandomRow). */
	pickRandomAvailableForTier(executor: Executor, tier: DeityTier): DeityRosterRow | null {
		const row = executor
			.select()
			.from(deityRoster)
			.where(and(eq(deityRoster.tier, tier), eq(deityRoster.isAvailable, true)))
			.orderBy(sql`RANDOM()`)
			.limit(1)
			.get();
		return row ?? null;
	}

	ownedDeityIds(executor: Executor, discordId: string): Set<number> {
		const rows = executor
			.select({ deityId: userDeities.deityId })
			.from(userDeities)
			.where(eq(userDeities.discordId, discordId))
			.all();
		return new Set(rows.map((r: { deityId: number }) => r.deityId));
	}

	/**
	 * Effective ATK/HP/DEF for one owned deity, computed AT READ TIME from
	 * base stats * sigilMultiplier(sigils) — per config/ascension.ts, NOT
	 * the legacy stored curr_atk/curr_hp/curr_def columns (those predate
	 * the Sigil/Ascension system and are no longer the source of truth).
	 */
	findUserDeityCurrStats(
		executor: Executor,
		userDeityId: number,
	): { currAtk: number; currHp: number; currDef: number } | null {
		const row = executor
			.select({
				sigils: userDeities.sigils,
				baseAtk: deityRoster.baseAtk,
				baseHp: deityRoster.baseHp,
				baseDef: deityRoster.baseDef,
			})
			.from(userDeities)
			.innerJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
			.where(eq(userDeities.userDeityId, userDeityId))
			.get();
		if (!row) return null;
		const eff = computeSigilStats({ atk: row.baseAtk, hp: row.baseHp, def: row.baseDef }, row.sigils);
		return { currAtk: eff.atk, currHp: eff.hp, currDef: eff.def };
	}

	findOwnedProgress(executor: Executor, discordId: string, userDeityId: number): OwnedDeityProgress | null {
		const row = executor
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
			.get();
		if (!row) return null;
		return { ...row, tier: row.tier as DeityTier };
	}

	setSigils(executor: Executor, userDeityId: number, sigils: number): void {
		executor.update(userDeities).set({ sigils }).where(eq(userDeities.userDeityId, userDeityId)).run();
	}

	setAscended(executor: Executor, userDeityId: number): void {
		executor.update(userDeities).set({ ascended: true }).where(eq(userDeities.userDeityId, userDeityId)).run();
	}

	/** New deity acquisition: curr_enhancement are legacy pre-Ascension columns, written once but never read again (see findUserDeityCurrStats). */
	insertNew(executor: Executor, discordId: string, deity: DeityRosterRow, todayKey: string): number {
		const result = executor
			.insert(userDeities)
			.values({
				discordId,
				deityId: deity.deityId,
				currAtk: deity.baseAtk,
				currHp: deity.baseHp,
				currDef: deity.baseDef,
				enhancement: 1,
				sigils: 0,
				ascended: false,
				lastPullDate: todayKey,
			})
			.run();
		return Number(result.lastInsertRowid);
	}
}
