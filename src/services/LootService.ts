import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag } from '../db/schema.js';
import { LootRepository } from '../repositories/LootRepository.js';
import { CHESTS, rollChest, type ChestKey } from '../config/chestLoot.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';

export const ESSENCE_FIELDS = {
	epic: 'epicEssence',
	mythic: 'mythicEssence',
	legendary: 'legendaryEssence',
	supreme: 'supremeEssence',
} as const;

const RUNE_BAG_LABEL: Record<string, string> = {
	lesserRuneBag: 'lb',
	greaterRuneBag: 'gb',
	divineRuneBag: 'db',
};

export class LootService {
	constructor(
		private readonly repo = new LootRepository(),
		private readonly events = EventBus.getInstance(),
	) {}
	async open(id: string, key: ChestKey, count: number): Promise<string> {
		if (!Object.hasOwn(CHESTS, key) || !Number.isInteger(count) || count < 1 || count > 10)
			return 'Chọn loại rương hợp lệ, số lượng 1–10.';
		let opened = false;
		const message = await db.transaction(async (tx) => {
			const bag = await this.repo.lockBag(tx, id);
			if (!bag) return 'Dùng /register trước.';
			const table = CHESTS[key];
			if (bag[table.column] < count) return 'Không đủ rương.';
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
			for (let n = 0; n < count; n++) {
				const roll = rollChest(key, rng);
				creux += roll.credux;
				shards += roll.shards;
				if (roll.essence) {
					essence[roll.essence]++;
					items.push(`+1 ${roll.essence}`);
				}
				if (roll.runeBag) {
					runeBags[roll.runeBag] += 1;
					items.push(`+1 túi rune (${RUNE_BAG_LABEL[roll.runeBag]})`);
				}
				if (roll.runeTier) items.push(await this.repo.rune(tx, id, rng, { tier: roll.runeTier }));
				if (roll.gearTier) items.push(await this.repo.gear(tx, id, roll.gearTier, rng));
			}
			await tx
				.update(usersBag)
				.set({
					[table.column]: bag[table.column] - count,
					credux: bag.credux + creux,
					beliefShards: bag.beliefShards + shards,
					lifetimeCreduxEarned: bag.lifetimeCreduxEarned + creux,
					...essence,
					lesserRuneBag: bag.lesserRuneBag + runeBags.lesserRuneBag,
					greaterRuneBag: bag.greaterRuneBag + runeBags.greaterRuneBag,
					divineRuneBag: bag.divineRuneBag + runeBags.divineRuneBag,
				})
				.where(eq(usersBag.discordId, id));
			await this.repo.log(tx, id, `Open ${count} ${key}`, bag.credux, bag.credux + creux);
			return `Mở ${count} ${table.label}: +${creux.toLocaleString()} Credux · +${shards} Shards\n${items.join('\n')}\n/equip · /socket · /inventory để sử dụng và tra ID.`;
		});
		if (opened) this.events.emit('chest.opened', { discordId: id, chest: key, count });
		return message;
	}

	/** /runes open bag:lb|gb|db — mở 1 túi rune đang nằm trong bag theo pool đã seed. */
	async openRuneBag(id: string, bagKey: string): Promise<string> {
		const field = { lb: 'lesserRuneBag', gb: 'greaterRuneBag', db: 'divineRuneBag' } as const;
		if (!Object.hasOwn(field, bagKey)) return 'Túi phải là lb | gb | db.';
		return db.transaction(async (tx) => {
			const bag = await this.repo.lockBag(tx, id);
			if (!bag) return 'Dùng /register trước.';
			const key = field[bagKey as keyof typeof field];
			if (bag[key] < 1) return 'Không đủ túi rune. Mở rương để lấy thêm.';
			const offer = (await this.repo.bags(tx)).find((b) => b.bagKey === bagKey);
			if (
				!offer ||
				!Array.isArray(offer.runePool) ||
				!offer.runePool.length ||
				!offer.runePool.every((n) => typeof n === 'string')
			)
				throw new Error('Pool rune không hợp lệ.');
			const item = await this.repo.rune(tx, id, createRng(createSecureSeed()), { names: offer.runePool });
			await tx
				.update(usersBag)
				.set({ [key]: bag[key] - 1 })
				.where(eq(usersBag.discordId, id));
			return `Mở túi ${bagKey}: ${item}\n/socket equip để gắn vào gear; /inventory category:runes xem lane.`;
		});
	}
	async shop(id: string, key?: string): Promise<string> {
		if (!key) {
			const bags = await this.repo.bags(db);
			return (
				bags
					.map(
						(b) =>
							`**${b.bagKey}**: ${b.essenceCost} ${b.essenceTier} essence + ${b.creduxCost.toLocaleString()} Credux\nPool: ${(b.runePool as string[]).join(', ')}`,
					)
					.join('\n\n') + '\n/runes shop bag:<mã> mua và mở ngay 1 rune.'
			);
		}
		return db.transaction(async (tx) => {
			const bag = await this.repo.lockBag(tx, id);
			if (!bag) return 'Dùng /register trước.';
			const offer = (await this.repo.bags(tx)).find((b) => b.bagKey === key);
			if (!offer || !Object.hasOwn(ESSENCE_FIELDS, offer.essenceTier)) return 'Túi rune không tồn tại.';
			const field = ESSENCE_FIELDS[offer.essenceTier as keyof typeof ESSENCE_FIELDS];
			if (bag.credux < offer.creduxCost || bag[field] < offer.essenceCost)
				return `Cần ${offer.essenceCost} ${offer.essenceTier} essence + ${offer.creduxCost.toLocaleString()} Credux.`;
			if (
				!Array.isArray(offer.runePool) ||
				!offer.runePool.length ||
				!offer.runePool.every((n) => typeof n === 'string')
			)
				throw new Error('Pool rune không hợp lệ.');
			const item = await this.repo.rune(tx, id, createRng(createSecureSeed()), { names: offer.runePool });
			await tx
				.update(usersBag)
				.set({ credux: bag.credux - offer.creduxCost, [field]: bag[field] - offer.essenceCost })
				.where(eq(usersBag.discordId, id));
			await this.repo.log(tx, id, `Rune bag ${key}`, bag.credux, bag.credux - offer.creduxCost);
			return `Nhận ${item}\nDùng /socket equip để gắn vào gear; /inventory category:runes xem lane.`;
		});
	}
}
