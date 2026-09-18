import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag, pityCounters, userCharacter, userPresets, gameLogs } from '../db/schema.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { DeityRepository, type DeityRosterRow } from '../repositories/DeityRepository.js';
import {
	resolveRoll,
	SHARDS_PER_PULL,
	MAX_PULLS,
	ESSENCE_PER_DUPLICATE,
	TIER_ESSENCE_FIELD,
	type DeityTier,
} from '../config/gachaRates.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { DailyCycle } from '../utils/dailyCycle.js';

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
	| { status: 'no-deities-seeded'; tier: DeityTier }
	| { status: 'ok'; pulls: SummonPullResult[]; finalPity: number; shardsSpent: number };

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
	constructor(
		private readonly characters = new UserCharacterRepository(),
		private readonly deities = new DeityRepository(),
	) {}

	async run(discordId: string, count: number): Promise<SummonResult> {
		if (!Number.isInteger(count) || count < 1 || count > MAX_PULLS) {
			return { status: 'invalid-count' };
		}

		return db.transaction(async (tx): Promise<SummonResult> => {
			if (!(await this.characters.hasCharacter(tx, discordId))) {
				// hasCharacter also covers "not registered" here, since a character
				// can't exist without a user row (FK), so one check suffices.
				return { status: 'no-character' };
			}

			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) throw new Error(`run: no users_bag row for ${discordId}`);
			const cost = SHARDS_PER_PULL * count;
			if (bag.beliefShards < cost) {
				return { status: 'insufficient-shards', needed: cost, have: bag.beliefShards };
			}

			const [pityRow] = await tx
				.select()
				.from(pityCounters)
				.where(eq(pityCounters.discordId, discordId))
				.limit(1);
			let pity = pityRow?.pityCount ?? 0;
			const owned = await this.deities.ownedDeityIds(tx, discordId);
			const rng = createRng(createSecureSeed());
			const todayKey = DailyCycle.keyAt();

			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1)
				.for('update');
			if (!character) throw new Error(`run: no user_character row for ${discordId}`);
			const [activePreset] = await tx
				.select()
				.from(userPresets)
				.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, character.activePresetSlot)))
				.limit(1);
			let pendingActiveDeityId: number | null = null;

			const essenceDelta: Record<DeityTier, number> = { Epic: 0, Mythic: 0, Legendary: 0, Supreme: 0 };
			const pulls: SummonPullResult[] = [];
			// Resolve every pull before any mutation: missing seed must not consume shards
			// or leave earlier pulls committed without their pity/essence updates.
			const planned: Array<{ tier: DeityTier; deity: DeityRosterRow }> = [];
			for (let i = 0; i < count; i++) {
				const roll = resolveRoll(pity, rng);
				pity = roll.newPity;
				const deity = await this.deities.pickRandomAvailableForTier(tx, roll.tier, rng);
				if (!deity) return { status: 'no-deities-seeded', tier: roll.tier };
				planned.push({ tier: roll.tier, deity });
			}

			// Debit shards up front: an early return below must not leave a
			// committed state where the player got a deity without paying.
			const beliefShardsAfter = bag.beliefShards - cost;
			await tx.update(usersBag).set({ beliefShards: beliefShardsAfter }).where(eq(usersBag.discordId, discordId));

			for (const roll of planned) {
				const deity = roll.deity;

				const isDupe = owned.has(deity.deityId);
				if (isDupe) {
					const gained = ESSENCE_PER_DUPLICATE[roll.tier];
					essenceDelta[roll.tier] += gained;
					pulls.push({
						tier: roll.tier,
						name: deity.name,
						mythology: deity.mythology,
						blessingName: deity.blessingName,
						isDupe: true,
						essenceGained: gained,
					});
				} else {
					const userDeityId = await this.deities.insertNew(tx, discordId, deity, todayKey);
					owned.add(deity.deityId);
					if (activePreset && activePreset.equippedDeity1Id == null && pendingActiveDeityId == null) {
						pendingActiveDeityId = userDeityId;
					}
					pulls.push({
						tier: roll.tier,
						name: deity.name,
						mythology: deity.mythology,
						blessingName: deity.blessingName,
						isDupe: false,
						essenceGained: 0,
					});
				}
			}

			// Persist essence deltas + log both. Shards were already debited before the pull loop.
			const patch: Record<string, number> = {};
			for (const tier of Object.keys(essenceDelta) as DeityTier[]) {
				if (essenceDelta[tier] === 0) continue;
				const field = TIER_ESSENCE_FIELD[tier];
				const before = bag[field];
				const after = before + essenceDelta[tier];
				patch[field] = after;
				await tx.insert(gameLogs).values({
					discordId,
					action: 'Deity Pull',
					itemType: field,
					previousEssenceCount: before,
					updatedEssenceCount: after,
				});
			}
			if (Object.keys(patch).length > 0) {
				await tx
					.update(usersBag)
					.set(patch as Partial<typeof usersBag.$inferInsert>)
					.where(eq(usersBag.discordId, discordId));
			}
			await tx.insert(gameLogs).values({
				discordId,
				action: 'Deity Pull',
				previousBeliefShards: bag.beliefShards,
				updatedBeliefShards: beliefShardsAfter,
			});

			await tx
				.insert(pityCounters)
				.values({ discordId, pityCount: pity })
				.onConflictDoUpdate({ target: pityCounters.discordId, set: { pityCount: pity } });

			if (pendingActiveDeityId != null && activePreset) {
				await tx
					.update(userCharacter)
					.set({ activeDeityId: pendingActiveDeityId })
					.where(eq(userCharacter.discordId, discordId));
				await tx
					.update(userPresets)
					.set({ equippedDeity1Id: pendingActiveDeityId })
					.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, activePreset.slot)));
			}

			return { status: 'ok', pulls, finalPity: pity, shardsSpent: cost };
		});
	}
}
