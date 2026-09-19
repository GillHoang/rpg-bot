import { and, eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import {
	cosmeticCatalog,
	equippedSkins,
	titleCatalog,
	userCharacter,
	userCosmetics,
	userTitles,
} from '../db/schema.js';
import { COSMETIC_TIER_MIN_LEVEL } from '../config/reputation.js';

/**
 * Cosmetic + title (M7). Catalog nằm trong seed; equip lưu xuống
 * equipped_skins / user_character.equipped_title_id. Cosmetic tier gate theo
 * believer level (config/reputation.ts). Grant helpers dùng được trong tx —
 * Duel/Ranked/Raid/PvpShop gọi trực tiếp, command dùng facade ngoài tx.
 */
export class CosmeticService {
	// --- In-tx grant helpers (used by other services) ---

	async grantCosmeticInTx(tx: Executor, discordId: string, cosmeticKey: string, source: string): Promise<boolean> {
		const [catalog] = await tx
			.select()
			.from(cosmeticCatalog)
			.where(eq(cosmeticCatalog.cosmeticKey, cosmeticKey))
			.limit(1);
		if (!catalog) throw new Error(`Thiếu cosmetic trong seed: ${cosmeticKey}`);
		const [row] = await tx
			.insert(userCosmetics)
			.values({ discordId, cosmeticId: catalog.cosmeticId, source })
			.onConflictDoNothing()
			.returning();
		return row != null;
	}

	/** Base cosmetics auto-granted (and equipped) when a character is created. */
	async grantBaseInTx(tx: Executor, discordId: string): Promise<void> {
		const bases = await tx.select().from(cosmeticCatalog).where(eq(cosmeticCatalog.isBase, true));
		for (const base of bases) {
			await tx
				.insert(userCosmetics)
				.values({ discordId, cosmeticId: base.cosmeticId, source: 'base' })
				.onConflictDoNothing();
			await tx
				.insert(equippedSkins)
				.values({ discordId, category: base.category, cosmeticId: base.cosmeticId })
				.onConflictDoNothing();
		}
	}

	async grantTitleInTx(tx: Executor, discordId: string, code: string): Promise<boolean> {
		const [catalog] = await tx.select().from(titleCatalog).where(eq(titleCatalog.code, code)).limit(1);
		if (!catalog) throw new Error(`Thiếu title trong seed: ${code}`);
		const [row] = await tx
			.insert(userTitles)
			.values({ discordId, titleId: catalog.titleId })
			.onConflictDoNothing()
			.returning();
		return row != null;
	}

	// --- Command facades ---

	async listCosmetics(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1);
			if (!character) return 'Dùng /create trước.';
			const catalog = await tx.select().from(cosmeticCatalog).orderBy(cosmeticCatalog.cosmeticId);
			const owned = await tx.select().from(userCosmetics).where(eq(userCosmetics.discordId, discordId));
			const equipped = await tx.select().from(equippedSkins).where(eq(equippedSkins.discordId, discordId));
			const ownedIds = new Set(owned.map((o) => o.cosmeticId));
			const equippedIds = new Set(equipped.map((e) => e.cosmeticId));
			return (
				'🎨 **Cosmetics**\n' +
				catalog
					.map((c) => {
						const has = ownedIds.has(c.cosmeticId);
						const equippedMark = equippedIds.has(c.cosmeticId) ? ' · [đang dùng]' : '';
						const lock = has
							? ''
							: ` · 🔒 cần believer level ${COSMETIC_TIER_MIN_LEVEL[c.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL]}`;
						return `#${c.cosmeticId} ${c.displayName} (${c.category}, tier ${c.tier})${equippedMark}${has ? '' : lock}`;
					})
					.join('\n') +
				'\n/cosmetic equip id:<#> để trang bị.'
			);
		});
	}

	async equipCosmetic(discordId: string, cosmeticId: number): Promise<string> {
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1);
			if (!character) return 'Dùng /create trước.';
			const [catalog] = await tx
				.select()
				.from(cosmeticCatalog)
				.where(eq(cosmeticCatalog.cosmeticId, cosmeticId))
				.limit(1);
			if (!catalog) return 'Cosmetic không tồn tại.';
			const [owned] = await tx
				.select()
				.from(userCosmetics)
				.where(and(eq(userCosmetics.discordId, discordId), eq(userCosmetics.cosmeticId, cosmeticId)))
				.limit(1);
			if (!owned)
				return `Bạn chưa sở hữu cosmetic này (tier ${catalog.tier} cần believer level ${COSMETIC_TIER_MIN_LEVEL[catalog.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL]}).`;
			await tx
				.insert(equippedSkins)
				.values({ discordId, category: catalog.category, cosmeticId })
				.onConflictDoUpdate({
					target: [equippedSkins.discordId, equippedSkins.category],
					set: { cosmeticId, updatedAt: new Date() },
				});
			return `Đã trang bị ${catalog.displayName} (${catalog.category}).`;
		});
	}

	async listTitles(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1);
			if (!character) return 'Dùng /create trước.';
			const catalog = await tx.select().from(titleCatalog).orderBy(titleCatalog.titleId);
			const owned = await tx.select().from(userTitles).where(eq(userTitles.discordId, discordId));
			const ownedIds = new Set(owned.map((o) => o.titleId));
			return (
				'🏷️ **Titles**\n' +
				catalog
					.map(
						(t) =>
							`#${t.titleId} **${t.display}**${ownedIds.has(t.titleId) ? (character.equippedTitleId === t.titleId ? ' · [đang dùng]' : '') : ' · 🔒'} — ${t.howTo}`,
					)
					.join('\n') +
				'\n/title equip id:<#> để đeo title.'
			);
		});
	}

	async equipTitle(discordId: string, titleId: number): Promise<string> {
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1);
			if (!character) return 'Dùng /create trước.';
			if (titleId === 0) {
				await tx
					.update(userCharacter)
					.set({ equippedTitleId: null })
					.where(eq(userCharacter.discordId, discordId));
				return 'Đã tháo title.';
			}
			const [owned] = await tx
				.select()
				.from(userTitles)
				.where(and(eq(userTitles.discordId, discordId), eq(userTitles.titleId, titleId)))
				.limit(1);
			if (!owned) return 'Bạn chưa có title này.';
			await tx
				.update(userCharacter)
				.set({ equippedTitleId: titleId })
				.where(eq(userCharacter.discordId, discordId));
			return 'Đã đeo title.';
		});
	}
}
