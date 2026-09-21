import { choose } from '../config/chestLoot.js';
import type { Executor } from '../db/client.js';
import {
	DeityDataRepository,
	type DeityRosterRow,
	type OwnedDeityProgress,
} from '../repositories/DeityDataRepository.js';
export type { DeityRosterRow, OwnedDeityProgress } from '../repositories/DeityDataRepository.js';
import type { DeityTier } from '../config/gachaRates.js';
import { computeSigilStats } from '../config/ascension.js';

export class DeityService {
	constructor(
		private readonly data: Pick<
			DeityDataRepository,
			| 'listAvailableForTier'
			| 'ownedDeityIds'
			| 'findAssemblyData'
			| 'findOwnedProgress'
			| 'setSigils'
			| 'setAscended'
			| 'insertNew'
		> = new DeityDataRepository(),
	) {}

	/** Uniform-random pick among available deities of one tier (matches the original's equal-weight pickRandomRow). */
	async pickRandomAvailableForTier(
		executor: Executor,
		tier: DeityTier,
		rng: () => number,
	): Promise<DeityRosterRow | null> {
		const rows = await this.data.listAvailableForTier(executor, tier);
		return rows.length ? choose(rows, rng) : null;
	}

	async ownedDeityIds(executor: Executor, discordId: string): Promise<Set<number>> {
		return this.data.ownedDeityIds(executor, discordId);
	}

	/**
	 * Effective ATK/HP/DEF for one owned deity, computed AT READ TIME from
	 * base stats * sigilMultiplier(sigils) — per config/ascension.ts, NOT
	 * the legacy stored curr_atk/curr_hp/curr_def columns (those predate
	 * the Sigil/Ascension system and are no longer the source of truth).
	 */
	async findUserDeityCurrStats(
		executor: Executor,
		userDeityId: number,
	): Promise<{ currAtk: number; currHp: number; currDef: number } | null> {
		const row = await this.findUserDeityAssemblyInfo(executor, userDeityId);
		if (!row) return null;
		return { currAtk: row.currAtk, currHp: row.currHp, currDef: row.currDef };
	}

	/**
	 * Everything stat assembly needs about one owned deity: effective Sigil
	 * stats, mythology (resonance), blessing key + scaling and sigils (blessing
	 * strength). One query, used per equipped pantheon slot.
	 */
	async findUserDeityAssemblyInfo(
		executor: Executor,
		userDeityId: number,
	): Promise<{
		currAtk: number;
		currHp: number;
		currDef: number;
		mythology: string;
		blessingKey: string;
		blessingScaling: string;
		sigils: number;
	} | null> {
		const row = await this.data.findAssemblyData(executor, userDeityId);
		if (!row) return null;
		const eff = computeSigilStats({ atk: row.baseAtk, hp: row.baseHp, def: row.baseDef }, row.sigils);
		return {
			currAtk: eff.atk,
			currHp: eff.hp,
			currDef: eff.def,
			mythology: row.mythology,
			blessingKey: row.blessingKey,
			blessingScaling: row.blessingScaling,
			sigils: row.sigils,
		};
	}

	async findOwnedProgress(
		executor: Executor,
		discordId: string,
		userDeityId: number,
	): Promise<OwnedDeityProgress | null> {
		return this.data.findOwnedProgress(executor, discordId, userDeityId);
	}

	async setSigils(executor: Executor, userDeityId: number, sigils: number): Promise<void> {
		await this.data.setSigils(executor, userDeityId, sigils);
	}

	async setAscended(executor: Executor, userDeityId: number): Promise<void> {
		await this.data.setAscended(executor, userDeityId);
	}

	/** New deity acquisition: curr_enhancement are legacy pre-Ascension columns, written once but never read again (see findUserDeityCurrStats). */
	async insertNew(executor: Executor, discordId: string, deity: DeityRosterRow, todayKey: string): Promise<number> {
		return this.data.insertNew(executor, {
			discordId,
			deityId: deity.deityId,
			currAtk: deity.baseAtk,
			currHp: deity.baseHp,
			currDef: deity.baseDef,
			enhancement: 1,
			sigils: 0,
			ascended: false,
			lastPullDate: todayKey,
		});
	}
}
