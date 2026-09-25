import { formatNumber } from '../../../shared/ui/text/format.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import { LootGrantService } from './LootGrantService.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
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
			const items: string[] = [];
			let creux = 0,
				shards = 0;
			const essence = {
				epicEssence: bag.epicEssence,
				mythicEssence: bag.mythicEssence,
				legendaryEssence: bag.legendaryEssence,
				supremeEssence: bag.supremeEssence,
			};
			const runeBags = { lesserRuneBag: 0, greaterRuneBag: 0, divineRuneBag: 0 };
			const relics = { sacredRelics: 0, supremeRelics: 0 };
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
			await this.queries.updateBag(tx, id, {
				[table.column]: bag[table.column] - count,
				credux: bag.credux + creux,
				beliefShards: bag.beliefShards + shards,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + creux,
				...essence,
				lesserRuneBag: bag.lesserRuneBag + runeBags.lesserRuneBag,
				greaterRuneBag: bag.greaterRuneBag + runeBags.greaterRuneBag,
				divineRuneBag: bag.divineRuneBag + runeBags.divineRuneBag,
				sacredRelics: bag.sacredRelics + relics.sacredRelics,
				supremeRelics: bag.supremeRelics + relics.supremeRelics,
			});
			await this.repo.log(tx, id, `Open ${count} ${key}`, bag.credux, bag.credux + creux);
			await this.repo.logLedger(tx, {
				discordId: id,
				action: `Open ${count} ${key}`,
				itemType: table.column,
				credux: [bag.credux, bag.credux + creux],
				shards: [bag.beliefShards, bag.beliefShards + shards],
				chest: [bag[table.column], bag[table.column] - count],
			});
			for (const [tier, gained] of Object.entries({
				epicEssence: essence.epicEssence - bag.epicEssence,
				mythicEssence: essence.mythicEssence - bag.mythicEssence,
				legendaryEssence: essence.legendaryEssence - bag.legendaryEssence,
				supremeEssence: essence.supremeEssence - bag.supremeEssence,
			})) {
				if (gained > 0) {
					const before = bag[tier as keyof typeof bag] as number;
					await this.repo.logLedger(tx, {
						discordId: id,
						action: `Open ${count} ${key}`,
						itemType: tier,
						essence: [before, before + gained],
					});
				}
			}
			for (const [relic, gained] of Object.entries({
				sacredRelics: relics.sacredRelics,
				supremeRelics: relics.supremeRelics,
			})) {
				if (gained > 0) {
					const before = bag[relic as keyof typeof bag] as number;
					await this.repo.logLedger(tx, {
						discordId: id,
						action: `Open ${count} ${key}`,
						itemType: relic,
						relic: [before, before + gained],
					});
				}
			}
			await this.progress.apply(tx, id, 'open_chest', this.clock.now(), count);
			return ok(
				OPEN_RESULT(count, table.label, formatNumber(creux), shards) +
					(items.length ? '\n' + items.join('\n') : '') +
					OPEN_HINT,
			);
		});
		if (message.ok && opened)
			this.events.emit('chest.opened', { discordId: id, chest: key, count, progressApplied: true });
		return message;
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
