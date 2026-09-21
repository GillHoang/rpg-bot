import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { SummonRepository } from '../repositories/SummonRepository.js';
import { randomUUID } from 'node:crypto';
import type { Executor } from '../db/client.js';
import type { usersBag, userPresets } from '../db/schema.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { DeityService, type DeityRosterRow } from './DeityService.js';
import {
	resolveRoll,
	SHARDS_PER_PULL,
	MAX_PULLS,
	ESSENCE_PER_DUPLICATE,
	TIER_ESSENCE_FIELD,
	RELIC_TIER_WEIGHTS,
	RELIC_FIELD,
	type DeityTier,
	type RelicKind,
} from '../config/gachaRates.js';
import { pick } from '../utils/weightedRandom.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { DailyCycle } from '../utils/dailyCycle.js';
import { EventBus } from '../core/EventBus.js';

type RelicField = 'sacredRelics' | 'supremeRelics';

interface PlannedPull {
	tier: DeityTier;
	deity: DeityRosterRow;
}

export interface SummonPullResult {
	tier: DeityTier;
	name: string;
	mythology: string;
	blessingName: string;
	isDupe: boolean;
	essenceGained: number;
}

export type SummonResult =
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'invalid-count' }
	| { status: 'insufficient-shards'; needed: number; have: number }
	| { status: 'insufficient-relics'; relic: RelicKind; needed: number; have: number }
	| { status: 'no-deities-seeded'; tier: DeityTier }
	| { status: 'ok'; pulls: SummonPullResult[]; finalPity: number; shardsSpent: number };

export interface SummonDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		SummonRepository,
		| 'lockBag'
		| 'findPity'
		| 'lockCharacter'
		| 'findPreset'
		| 'insertShardLog'
		| 'upsertPity'
		| 'updateActiveDeity'
		| 'updatePresetDeity'
		| 'updateRelicBalance'
		| 'insertRelicGrant'
		| 'updateShardBalance'
		| 'insertEssenceLog'
		| 'updateEssenceBalances'
	>;
}

/**
 * Facade for `/summon`. Ported from engine/summonEngine.js's runSummon —
 * the "crd summon" (belief-shard) path only; relic-forced-tier pulls and
 * the reputation/believer-EXP award (Master §18, its own subsystem) are
 * deferred.
 *
 * Auto-equip simplification: the original tracks the active deity per
 * preset slot 1 (user_presets.equipped_deity_1_id) via a full loadout
 * read. This ports that same target column, but only ever looks at the
 * character's *currently active* preset (activePresetSlot) rather than
 * the full loadout object the original assembles.
 */

export class SummonService {
	private readonly persistence: PersistenceContext;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly deities: Pick<DeityService, 'ownedDeityIds' | 'pickRandomAvailableForTier' | 'insertNew'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: NonNullable<SummonDependencies['queries']>;
	constructor(
		characters: Pick<UserCharacterRepository, 'hasCharacter'> | undefined = undefined,
		deities:
			Pick<DeityService, 'ownedDeityIds' | 'pickRandomAvailableForTier' | 'insertNew'> | undefined = undefined,
		events: Pick<EventBus, 'emit'> | undefined = undefined,
		options: SummonDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.characters = characters ?? new UserCharacterRepository();
		this.deities = deities ?? new DeityService();
		this.events = events ?? EventBus.getInstance();
		this.queries = options.queries ?? new SummonRepository();
	}

	async run(discordId: string, count: number, relic?: RelicKind): Promise<SummonResult> {
		if (!Number.isInteger(count) || count < 1 || count > MAX_PULLS) {
			return { status: 'invalid-count' };
		}

		const result = await this.persistence.unitOfWork.run(async (tx) => this.runInTx(tx, discordId, count, relic));

		if (result.status === 'ok') {
			this.events.emit('summon.done', { discordId, count });
		}
		return result;
	}

	/**
	 * Transaction body of run(). Kept as a separate method so every guard is
	 * at nesting depth 0 — Sonar cognitive complexity stays under budget.
	 */
	private async runInTx(
		tx: Executor,
		discordId: string,
		count: number,
		relic: RelicKind | undefined,
	): Promise<SummonResult> {
		if (!(await this.characters.hasCharacter(tx, discordId))) {
			// hasCharacter also covers "not registered" here, since a character
			// can't exist without a user row (FK), so one check suffices.
			return { status: 'no-character' };
		}
		const [bag] = await this.queries.lockBag(tx, discordId);
		if (!bag) throw new Error(`run: no users_bag row for ${discordId}`);

		const funds = this.checkFunds(bag, count, relic);
		if (funds) return funds;
		const relicField = relic ? RELIC_FIELD[relic] : null;
		const cost = relic ? 0 : SHARDS_PER_PULL * count;

		const [pityRow] = await this.queries.findPity(tx, discordId);
		const pityBefore = pityRow?.pityCount ?? 0;
		const rng = createRng(createSecureSeed());
		const planned = await this.planPulls(tx, count, relic, rng, pityBefore);
		if ('missingTier' in planned) return { status: 'no-deities-seeded', tier: planned.missingTier };

		// Debit the currency up front: an early return below must not leave a
		// committed state where the player got a deity without paying.
		await this.debit(tx, discordId, bag, count, relic, relicField, cost);
		const owned = await this.deities.ownedDeityIds(tx, discordId);
		const [character] = await this.queries.lockCharacter(tx, discordId);
		if (!character) throw new Error(`run: no user_character row for ${discordId}`);
		const [activePreset] = await this.queries.findPreset(tx, discordId, character.activePresetSlot);

		const { pulls, essenceDelta, pendingActiveDeityId } = await this.grantPlanned(
			tx,
			discordId,
			planned.planned,
			owned,
			DailyCycle.keyAt(),
			activePreset ?? null,
		);
		await this.creditEssence(tx, discordId, bag, essenceDelta);
		if (!relic) {
			await this.queries.insertShardLog(tx, {
				discordId,
				action: 'Deity Pull',
				previousBeliefShards: bag.beliefShards,
				updatedBeliefShards: bag.beliefShards - cost,
			});
			await this.queries.upsertPity(tx, planned.pityAfter, { discordId, pityCount: planned.pityAfter });
		}

		if (pendingActiveDeityId != null && activePreset) {
			await this.queries.updateActiveDeity(tx, discordId, { activeDeityId: pendingActiveDeityId });
			await this.queries.updatePresetDeity(tx, discordId, activePreset.slot, {
				equippedDeity1Id: pendingActiveDeityId,
			});
		}

		return { status: 'ok', pulls, finalPity: planned.pityAfter, shardsSpent: cost };
	}

	private checkFunds(
		bag: typeof usersBag.$inferSelect,
		count: number,
		relic: RelicKind | undefined,
	): Extract<SummonResult, { status: 'insufficient-shards' | 'insufficient-relics' }> | null {
		if (!relic) {
			const cost = SHARDS_PER_PULL * count;
			if (bag.beliefShards < cost) {
				return { status: 'insufficient-shards', needed: cost, have: bag.beliefShards };
			}
			return null;
		}
		const field = RELIC_FIELD[relic];
		if (bag[field] < count) {
			return { status: 'insufficient-relics', relic, needed: count, have: bag[field] };
		}
		return null;
	}

	/** Resolve every pull before any mutation: missing seed must not consume shards or relics. */
	private async planPulls(
		tx: Executor,
		count: number,
		relic: RelicKind | undefined,
		rng: () => number,
		pityBefore: number,
	): Promise<{ planned: PlannedPull[]; pityAfter: number } | { missingTier: DeityTier }> {
		const planned: PlannedPull[] = [];
		let pity = pityBefore;
		for (let i = 0; i < count; i++) {
			let tier: DeityTier;
			if (relic) {
				tier = pick(
					RELIC_TIER_WEIGHTS[relic].map(([original, weight]) => ({ original, weight })),
					{ next: rng },
				);
			} else {
				const roll = resolveRoll(pity, rng);
				pity = roll.newPity;
				tier = roll.tier;
			}
			const deity = await this.deities.pickRandomAvailableForTier(tx, tier, rng);
			if (!deity) return { missingTier: tier };
			planned.push({ tier, deity });
		}
		return { planned, pityAfter: pity };
	}

	private async debit(
		tx: Executor,
		discordId: string,
		bag: typeof usersBag.$inferSelect,
		count: number,
		relic: RelicKind | undefined,
		relicField: RelicField | null,
		cost: number,
	): Promise<void> {
		if (relic && relicField) {
			await this.queries.updateRelicBalance(tx, discordId, { [relicField]: bag[relicField] - count });
			for (let i = 0; i < count; i++) {
				await this.queries.insertRelicGrant(tx, {
					// UUID suffix: two pulls in the same millisecond must not collide.
					rewardKey: `${discordId}:${DailyCycle.keyAt()}:${i}:${randomUUID()}`,
					discordId,
					source: `${relic}_relic`,
				});
			}
			return;
		}
		await this.queries.updateShardBalance(tx, discordId, { beliefShards: bag.beliefShards - cost });
	}

	private async grantPlanned(
		tx: Executor,
		discordId: string,
		planned: PlannedPull[],
		owned: Set<number>,
		todayKey: string,
		activePreset: typeof userPresets.$inferSelect | null,
	): Promise<{
		pulls: SummonPullResult[];
		essenceDelta: Record<DeityTier, number>;
		pendingActiveDeityId: number | null;
	}> {
		const essenceDelta: Record<DeityTier, number> = { Epic: 0, Mythic: 0, Legendary: 0, Supreme: 0 };
		const pulls: SummonPullResult[] = [];
		let pendingActiveDeityId: number | null = null;

		for (const { tier, deity } of planned) {
			const isDupe = owned.has(deity.deityId);
			if (isDupe) {
				const gained = ESSENCE_PER_DUPLICATE[tier];
				essenceDelta[tier] += gained;
				pulls.push({
					tier,
					name: deity.name,
					mythology: deity.mythology,
					blessingName: deity.blessingName,
					isDupe: true,
					essenceGained: gained,
				});
				continue;
			}
			const userDeityId = await this.deities.insertNew(tx, discordId, deity, todayKey);
			owned.add(deity.deityId);
			// Auto-equip the first new deity while the pantheon lead slot is empty.
			if (activePreset && activePreset.equippedDeity1Id == null && pendingActiveDeityId == null) {
				pendingActiveDeityId = userDeityId;
			}
			pulls.push({
				tier,
				name: deity.name,
				mythology: deity.mythology,
				blessingName: deity.blessingName,
				isDupe: false,
				essenceGained: 0,
			});
		}
		return { pulls, essenceDelta, pendingActiveDeityId };
	}

	private async creditEssence(
		tx: Executor,
		discordId: string,
		bag: typeof usersBag.$inferSelect,
		essenceDelta: Record<DeityTier, number>,
	): Promise<void> {
		const patch: Record<string, number> = {};
		for (const tier of Object.keys(essenceDelta) as DeityTier[]) {
			if (essenceDelta[tier] === 0) continue;
			const field = TIER_ESSENCE_FIELD[tier];
			const before = bag[field];
			const after = before + essenceDelta[tier];
			patch[field] = after;
			await this.queries.insertEssenceLog(tx, {
				discordId,
				action: 'Deity Pull',
				itemType: field,
				previousEssenceCount: before,
				updatedEssenceCount: after,
			});
		}
		if (Object.keys(patch).length > 0) {
			await this.queries.updateEssenceBalances(tx, discordId, patch as Partial<typeof usersBag.$inferInsert>);
		}
	}
}
