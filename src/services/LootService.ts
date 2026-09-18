import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag } from '../db/schema.js';
import { LootRepository } from '../repositories/LootRepository.js';
import { CHESTS, rollChest, type ChestKey } from '../config/chestLoot.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';

export const ESSENCE_FIELDS = {
	epic: 'epicEssence',
	mythic: 'mythicEssence',
	legendary: 'legendaryEssence',
	supreme: 'supremeEssence',
} as const;
export class LootService {
	constructor(private readonly repo = new LootRepository()) {}
	async open(id: string, key: ChestKey, count: number): Promise<string> {
		if (!Object.hasOwn(CHESTS, key) || !Number.isInteger(count) || count < 1 || count > 10)
			return 'Chọn loại rương hợp lệ, số lượng 1–10.';
		return db.transaction(async (tx) => {
			const bag = await this.repo.lockBag(tx, id);
			if (!bag) return 'Dùng /register trước.';
			const table = CHESTS[key];
			if (bag[table.column] < count) return 'Không đủ rương.';
			const rng = createRng(createSecureSeed());
			const items: string[] = [];
			let credux = 0,
				shards = 0;
			const essence = { mythicEssence: bag.mythicEssence, legendaryEssence: bag.legendaryEssence };
			for (let n = 0; n < count; n++) {
				const roll = rollChest(key, rng);
				credux += roll.credux;
				shards += roll.shards;
				if (roll.essence) {
					essence[roll.essence]++;
					items.push(`+1 ${roll.essence}`);
				}
				if (roll.runeTier) items.push(await this.repo.rune(tx, id, rng, { tier: roll.runeTier }));
				if (roll.gearTier) items.push(await this.repo.gear(tx, id, roll.gearTier, rng));
			}
			await tx
				.update(usersBag)
				.set({
					[table.column]: bag[table.column] - count,
					credux: bag.credux + credux,
					beliefShards: bag.beliefShards + shards,
					lifetimeCreduxEarned: bag.lifetimeCreduxEarned + credux,
					...essence,
				})
				.where(eq(usersBag.discordId, id));
			await this.repo.log(tx, id, `Open ${count} ${key}`, bag.credux, bag.credux + credux);
			return `Mở ${count} ${table.label}: +${credux.toLocaleString()} Credux · +${shards} Shards\n${items.join('\n')}\n/equip · /socket · /inventory để sử dụng và tra ID.`;
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
