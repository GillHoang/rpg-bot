import { formatNumber } from '../../../shared/ui/text/format.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import { LootGrantService } from './LootGrantService.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { Executor } from '../../../db/client.js';
import { LootInventoryRepository } from '../infrastructure/LootInventoryRepository.js';
import { LootRepository } from '../infrastructure/LootRepository.js';
import { CHESTS, rollChest, type ChestKey } from '../../../shared/config/chestLoot.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';
import { AppError, err, ok, type Result } from '../../../shared/kernel/Result.js';
import { systemClock, type Clock } from '../../../shared/kernel/clock.js';
import {
	OPEN_BAD_COUNT,
	OPEN_HINT,
	OPEN_ITEM_ESSENCE,
	OPEN_ITEM_RELIC,
	OPEN_ITEM_RUNE_BAG,
	OPEN_NO_CHESTS,
	OPEN_NO_REGISTER,
	OPEN_RESULT,
	RUNE_BAG_BAD_KEY,
	RUNE_BAG_EMPTY,
	RUNE_BAG_HINT,
	RUNE_BAG_OPENED,
	RUNE_BAG_SHORT_LABEL,
	RUNE_POOL_INVALID,
	RUNE_RECEIVED,
	RUNE_RECEIVED_HINT,
	RUNES_BAG_NOT_FOUND,
	RUNES_COST_NEEDED,
	RUNES_SHOP_FOOTER,
	RUNES_SHOP_OFFER,
	RUNES_SHOP_POOL,
} from '../../../shared/ui/text/loot.js';

export const ESSENCE_FIELDS = {
	epic: 'epicEssence',
	mythic: 'mythicEssence',
	legendary: 'legendaryEssence',
	supreme: 'supremeEssence',
} as const;

export interface LootDependencies {
	progress?: Pick<GameplayProgressCoordinator, 'apply'>;
	grants?: Pick<LootGrantService, 'rune' | 'gear'>;
	persistence: PersistenceContext;
	clock?: Clock;
	queries?: Pick<LootInventoryRepository, 'updateBag'>;
}

type LootSource = Pick<LootRepository, 'lockBag' | 'log' | 'logLedger' | 'bags' | 'findRunePool'> &
	Partial<Pick<LootGrantService, 'rune' | 'gear'>>;

type LockedBag = NonNullable<Awaited<ReturnType<LootRepository['lockBag']>>>;

/** Zero-based chest-open gains; the caller adds them onto the locked bag row. */
interface ChestGains {
	items: string[];
	creux: number;
	shards: number;
	essence: Record<'epicEssence' | 'mythicEssence' | 'legendaryEssence' | 'supremeEssence', number>;
	runeBags: Record<'lesserRuneBag' | 'greaterRuneBag' | 'divineRuneBag', number>;
	relics: Record<'sacredRelics' | 'supremeRelics', number>;
}

export class LootService {
	private readonly grants: Pick<LootGrantService, 'rune' | 'gear'>;
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly repo: Pick<LootRepository, 'lockBag' | 'log' | 'logLedger' | 'bags' | 'findRunePool'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<LootInventoryRepository, 'updateBag'>;

	constructor(
		repo?: LootSource,
		events?: Pick<EventBus, 'emit'>,
		options: LootDependencies = {} as LootDependencies,
	) {
		this.persistence = requirePersistence(options, 'LootService');
		this.clock = options.clock ?? systemClock;
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.repo = repo ?? new LootRepository();
		// Preserve earlier positional collaborators that supplied both storage and grants.
		this.grants =
			options.grants ??
			(repo?.rune && repo.gear
				? { rune: repo.rune.bind(repo), gear: repo.gear.bind(repo) }
				: new LootGrantService());
		this.events = events ?? new EventBus();
		this.queries = options.queries ?? new LootInventoryRepository();
	}
	async open(id: string, key: ChestKey, count: number): Promise<Result<string, AppError>> {
		if (!Object.hasOwn(CHESTS, key) || !Number.isInteger(count) || count < 1 || count > 10)
			return err(new AppError('LOOT_BAD_COUNT', OPEN_BAD_COUNT));
		let opened = false;
		const message = await this.persistence.unitOfWork.run(async (tx): Promise<Result<string, AppError>> => {
			const bag = await this.repo.lockBag(tx, id);
			if (!bag) return err(new AppError('LOOT_NO_REGISTER', OPEN_NO_REGISTER));
			const table = CHESTS[key];
			if (bag[table.column] < count) return err(new AppError('LOOT_NO_CHESTS', OPEN_NO_CHESTS));
			opened = true;
			const rng = createRng(createSecureSeed());
			const gained = await this.accumulateRolls(tx, id, key, count, rng);
			await this.queries.updateBag(tx, id, {
				[table.column]: bag[table.column] - count,
				credux: bag.credux + gained.creux,
				beliefShards: bag.beliefShards + gained.shards,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + gained.creux,
				epicEssence: bag.epicEssence + gained.essence.epicEssence,
				mythicEssence: bag.mythicEssence + gained.essence.mythicEssence,
				legendaryEssence: bag.legendaryEssence + gained.essence.legendaryEssence,
				supremeEssence: bag.supremeEssence + gained.essence.supremeEssence,
				lesserRuneBag: bag.lesserRuneBag + gained.runeBags.lesserRuneBag,
				greaterRuneBag: bag.greaterRuneBag + gained.runeBags.greaterRuneBag,
				divineRuneBag: bag.divineRuneBag + gained.runeBags.divineRuneBag,
				sacredRelics: bag.sacredRelics + gained.relics.sacredRelics,
				supremeRelics: bag.supremeRelics + gained.relics.supremeRelics,
			});
			const action = `Open ${count} ${key}`;
			await this.repo.log(tx, id, action, bag.credux, bag.credux + gained.creux);
			await this.repo.logLedger(tx, {
				discordId: id,
				action,
				itemType: table.column,
				credux: [bag.credux, bag.credux + gained.creux],
				shards: [bag.beliefShards, bag.beliefShards + gained.shards],
				chest: [bag[table.column], bag[table.column] - count],
			});
			await this.logBonusLedgers(tx, id, action, bag, gained);
			await this.progress.apply(tx, id, 'open_chest', this.clock.now(), count);
			return ok(
				OPEN_RESULT(count, table.label, formatNumber(gained.creux), gained.shards) +
					(gained.items.length ? '\n' + gained.items.join('\n') : '') +
					OPEN_HINT,
			);
		});
		if (message.ok && opened)
			this.events.emit('chest.opened', { discordId: id, chest: key, count, progressApplied: true });
		return message;
	}

	/** Roll every chest and grant rune/gear drops; pure accumulation, no bag writes. */
	private async accumulateRolls(
		tx: Executor,
		id: string,
		key: ChestKey,
		count: number,
		rng: () => number,
	): Promise<ChestGains> {
		const items: string[] = [];
		let creux = 0;
		let shards = 0;
		const essence: ChestGains['essence'] = {
			epicEssence: 0,
			mythicEssence: 0,
			legendaryEssence: 0,
			supremeEssence: 0,
		};
		const runeBags: ChestGains['runeBags'] = { lesserRuneBag: 0, greaterRuneBag: 0, divineRuneBag: 0 };
		const relics: ChestGains['relics'] = { sacredRelics: 0, supremeRelics: 0 };
		for (let n = 0; n < count; n++) {
			const roll = rollChest(key, rng);
			creux += roll.credux;
			shards += roll.shards;
			if (roll.essence) {
				essence[roll.essence]++;
				items.push(OPEN_ITEM_ESSENCE(roll.essence));
			}
			if (roll.runeBag) {
				runeBags[roll.runeBag] += 1;
				items.push(OPEN_ITEM_RUNE_BAG(RUNE_BAG_SHORT_LABEL[roll.runeBag]));
			}
			if (roll.relic) {
				relics[roll.relic] += 1;
				items.push(OPEN_ITEM_RELIC(roll.relic));
			}
			if (roll.runeTier) items.push(await this.grants.rune(tx, id, rng, { tier: roll.runeTier }));
			if (roll.gearTier) items.push(await this.grants.gear(tx, id, roll.gearTier, rng));
		}
		return { items, creux, shards, essence, runeBags, relics };
	}

	/** Essence/relic audit rows for nonzero gains (the main chest delta is logged by the caller). */
	private async logBonusLedgers(
		tx: Executor,
		id: string,
		action: string,
		bag: LockedBag,
		gained: ChestGains,
	): Promise<void> {
		const rows: Array<{ itemType: string; before: number; after: number; kind: 'essence' | 'relic' }> = [
			...(['epicEssence', 'mythicEssence', 'legendaryEssence', 'supremeEssence'] as const).map((tier) => ({
				itemType: tier,
				before: bag[tier],
				after: bag[tier] + gained.essence[tier],
				kind: 'essence' as const,
			})),
			...(['sacredRelics', 'supremeRelics'] as const).map((relic) => ({
				itemType: relic,
				before: bag[relic],
				after: bag[relic] + gained.relics[relic],
				kind: 'relic' as const,
			})),
		];
		for (const row of rows) {
			if (row.after <= row.before) continue;
			if (row.kind === 'essence') {
				await this.repo.logLedger(tx, {
					discordId: id,
					action,
					itemType: row.itemType,
					essence: [row.before, row.after],
				});
			} else {
				await this.repo.logLedger(tx, {
					discordId: id,
					action,
					itemType: row.itemType,
					relic: [row.before, row.after],
				});
			}
		}
	}

	/** /runes open bag:lb|gb|db — mở 1 túi rune đang nằm trong bag theo pool đã seed. */
	async openRuneBag(id: string, bagKey: string): Promise<Result<string, AppError>> {
		const field = { lb: 'lesserRuneBag', gb: 'greaterRuneBag', db: 'divineRuneBag' } as const;
		if (!Object.hasOwn(field, bagKey)) return err(new AppError('RUNE_BAG_BAD_KEY', RUNE_BAG_BAD_KEY));
		return this.persistence.unitOfWork.run(async (tx): Promise<Result<string, AppError>> => {
			const bag = await this.repo.lockBag(tx, id);
			if (!bag) return err(new AppError('LOOT_NO_REGISTER', OPEN_NO_REGISTER));
			const key = field[bagKey as keyof typeof field];
			if (bag[key] < 1) return err(new AppError('RUNE_BAG_EMPTY', RUNE_BAG_EMPTY));
			const offer = (await this.repo.bags(tx)).find((b) => b.bagKey === bagKey);
			if (
				!offer ||
				!Array.isArray(offer.runePool) ||
				!offer.runePool.length ||
				!offer.runePool.every((n) => typeof n === 'string')
			)
				throw new AppError('LOOT_INVALID_RUNE_POOL', RUNE_POOL_INVALID);
			const item = await this.grants.rune(tx, id, createRng(createSecureSeed()), { names: offer.runePool });
			await this.queries.updateBag(tx, id, { [key]: bag[key] - 1 });
			await this.repo.logLedger(tx, {
				discordId: id,
				action: `Rune bag ${bagKey}`,
				itemType: key,
				chest: [bag[key], bag[key] - 1],
			});
			return ok(RUNE_BAG_OPENED(bagKey, item) + RUNE_BAG_HINT);
		});
	}

	async shop(id: string, key?: string): Promise<Result<string, AppError>> {
		if (!key) {
			const bags = await this.repo.bags(this.persistence.executor);
			// Display the actually-grantable pool (isAvailable-filtered), not
			// the raw seed list — the grant path charges full price, so the
			// listing must never promise an unavailable rune.
			const lines: string[] = [];
			for (const b of bags) {
				const available = await this.repo.findRunePool(this.persistence.executor, {
					names: b.runePool as string[],
				});
				lines.push(
					RUNES_SHOP_OFFER(b.bagKey, b.essenceCost, b.essenceTier, formatNumber(b.creduxCost)) +
						'\n' +
						RUNES_SHOP_POOL(available.map((r) => r.name).join(', ')),
				);
			}
			return ok(lines.join('\n\n') + RUNES_SHOP_FOOTER);
		}
		return this.persistence.unitOfWork.run(async (tx): Promise<Result<string, AppError>> => {
			const bag = await this.repo.lockBag(tx, id);
			if (!bag) return err(new AppError('LOOT_NO_REGISTER', OPEN_NO_REGISTER));
			const offer = (await this.repo.bags(tx)).find((b) => b.bagKey === key);
			if (!offer || !Object.hasOwn(ESSENCE_FIELDS, offer.essenceTier))
				return err(new AppError('RUNES_BAG_NOT_FOUND', RUNES_BAG_NOT_FOUND));
			const field = ESSENCE_FIELDS[offer.essenceTier as keyof typeof ESSENCE_FIELDS];
			if (bag.credux < offer.creduxCost || bag[field] < offer.essenceCost)
				return err(
					new AppError(
						'RUNES_COST_NEEDED',
						RUNES_COST_NEEDED(offer.essenceCost, offer.essenceTier, formatNumber(offer.creduxCost)),
					),
				);
			if (
				!Array.isArray(offer.runePool) ||
				!offer.runePool.length ||
				!offer.runePool.every((n) => typeof n === 'string')
			)
				throw new AppError('LOOT_INVALID_RUNE_POOL', RUNE_POOL_INVALID);
			const item = await this.grants.rune(tx, id, createRng(createSecureSeed()), { names: offer.runePool });
			await this.queries.updateBag(tx, id, {
				credux: bag.credux - offer.creduxCost,
				[field]: bag[field] - offer.essenceCost,
			});
			await this.repo.log(tx, id, `Rune bag ${key}`, bag.credux, bag.credux - offer.creduxCost);
			await this.repo.logLedger(tx, {
				discordId: id,
				action: `Rune bag ${key}`,
				itemType: field,
				credux: [bag.credux, bag.credux - offer.creduxCost],
				essence: [bag[field], bag[field] - offer.essenceCost],
			});
			return ok(RUNE_RECEIVED(item) + RUNE_RECEIVED_HINT);
		});
	}
}
