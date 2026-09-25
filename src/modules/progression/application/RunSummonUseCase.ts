import { ok, type Result, AppError } from '../../../shared/kernel/Result.js';
import type { UseCase } from '../../../shared/kernel/UseCase.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { systemClock, type Clock } from '../../../shared/kernel/clock.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';
import { SummonRepository } from '../infrastructure/SummonRepository.js';
import { UserCharacterRepository } from '../../identity/infrastructure/UserCharacterRepository.js';
import { DeityService, type DeityRosterRow } from './DeityService.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import type { Executor } from '../../../db/client.js';
import type { usersBag, userPresets } from '../../../db/schema.js';
import { randomUUID } from 'node:crypto';
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
} from '../../../shared/config/gachaRates.js';
import { pick } from '../../../shared/utils/weightedRandom.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { DailyCycle } from '../../../shared/utils/dailyCycle.js';
import { PROGRESSION_MODULE_ERROR_TEXT, SUMMON_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import type {
	RunSummonOptions,
	SummonCharactersPort,
	SummonDeitiesPort,
	SummonEventsPort,
	SummonRepoPort,
	SummonProgressPort,
} from './ports.js';
import type { SummonPullResult, SummonResult } from './types.js';

type RelicField = 'sacredRelics' | 'supremeRelics';

interface PlannedPull {
	tier: DeityTier;
	deity: DeityRosterRow;
}

export interface RunSummonInput {
	discordId: string;
	count: number;
	relic?: RelicKind;
}

/**
 * Owns the `/summon` transaction: fund guards, pity-tracked planning, debit,
 * grants with duplicate essence, auto-equip and progress — all atomic.
 * The domain event fires after commit.
 */
export class RunSummonUseCase implements UseCase<RunSummonInput, SummonResult> {
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly progress: SummonProgressPort;
	private readonly characters: SummonCharactersPort;
	private readonly deities: SummonDeitiesPort;
	private readonly events: SummonEventsPort;
	private readonly queries: SummonRepoPort;

	constructor(
		characters?: SummonCharactersPort,
		deities?: SummonDeitiesPort,
		events?: SummonEventsPort,
		options: RunSummonOptions = {} as RunSummonOptions,
	) {
		this.persistence = requirePersistence(options, 'RunSummonUseCase');
		this.clock = options.clock ?? systemClock;
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.characters = characters ?? new UserCharacterRepository();
		this.deities = deities ?? new DeityService();
		this.events = events ?? new EventBus();
		this.queries = options.queries ?? new SummonRepository();
	}

	/** Direct run entry point used by the summon command. */
	async run(discordId: string, count: number, relic?: RelicKind): Promise<SummonResult> {
		const result = await this.execute({ discordId, count, relic });
		if (!result.ok) throw result.error;
		return result.value;
	}

	async execute(input: RunSummonInput): Promise<Result<SummonResult, AppError>> {
		if (!input.discordId) {
			return {
				ok: false,
				error: new AppError('VALIDATION_EMPTY_DISCORD_ID', PROGRESSION_MODULE_ERROR_TEXT.emptyDiscordId),
			};
		}
		if (!Number.isInteger(input.count) || input.count < 1 || input.count > MAX_PULLS) {
			return ok({ status: 'invalid-count' });
		}
		const result = await this.persistence.unitOfWork.run(async (tx) =>
			this.runInTx(tx, input.discordId, input.count, input.relic),
		);
		if (result.status === 'ok') {
			this.events.emit('summon.done', { discordId: input.discordId, count: input.count, progressApplied: true });
		}
		return ok(result);
	}

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
		if (!bag) throw new AppError('SUMMON_MISSING_BAG', SUMMON_ERROR_TEXT.missingBag(discordId));

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
		if (!character) throw new AppError('SUMMON_MISSING_CHARACTER', SUMMON_ERROR_TEXT.missingCharacter(discordId));
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
			await this.queries.updatePresetDeity(tx, discordId, activePreset.slot, {
				equippedDeity1Id: pendingActiveDeityId,
			});
		}

		await this.progress.apply(tx, discordId, 'summon', this.clock.now(), count);
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
