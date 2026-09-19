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
import {
	COSMETIC_ENTRY,
	COSMETIC_EQUIPPED,
	COSMETIC_EQUIPPED_MARK,
	COSMETIC_LIST_FOOTER,
	COSMETIC_LIST_HEADER,
	COSMETIC_LOCK,
	COSMETIC_NOT_FOUND,
	COSMETIC_NOT_OWNED,
	COSMETIC_NO_CHARACTER,
	COSMETIC_SEED_MISSING,
	COSMETIC_TIER_LOCKED,
	TITLE_EQUIPPED,
	TITLE_EQUIPPED_MARK,
	TITLE_ENTRY,
	TITLE_LIST_FOOTER,
	TITLE_LIST_HEADER,
	TITLE_LOCK_MARK,
	TITLE_NOT_OWNED,
	TITLE_REMOVED,
	TITLE_SEED_MISSING,
} from '../text/cosmetic.js';

/**
 * Cosmetic + title (M7). Catalog nằm trong seed; equip lưu xuống
 * equipped_skins / user_character.equipped_title_id. Cosmetic tier gate theo
 * believer level (config/reputation.ts). Grant helpers dùng được trong tx —
 * Duel/Ranked/Raid/PvpShop gọi trực tiếp, command dùng facade ngoài tx.
 * Wording nằm ở src/text/cosmetic.ts.
 */
export class CosmeticService {
	// --- In-tx grant helpers (used by other services) ---

	async grantCosmeticInTx(tx: Executor, discordId: string, cosmeticKey: string, source: string): Promise<boolean> {
		const [catalog] = await tx
			.select()
			.from(cosmeticCatalog)
			.where(eq(cosmeticCatalog.cosmeticKey, cosmeticKey))
			.limit(1);
		if (!catalog) throw new Error(COSMETIC_SEED_MISSING(cosmeticKey));
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
		if (!catalog) throw new Error(TITLE_SEED_MISSING(code));
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
			if (!character) return COSMETIC_NO_CHARACTER;
			const catalog = await tx.select().from(cosmeticCatalog).orderBy(cosmeticCatalog.cosmeticId);
			const owned = await tx.select().from(userCosmetics).where(eq(userCosmetics.discordId, discordId));
			const equipped = await tx.select().from(equippedSkins).where(eq(equippedSkins.discordId, discordId));
			const ownedIds = new Set(owned.map((o) => o.cosmeticId));
			const equippedIds = new Set(equipped.map((e) => e.cosmeticId));
			return (
				COSMETIC_LIST_HEADER +
				'\n' +
				catalog
					.map((c) => {
						const has = ownedIds.has(c.cosmeticId);
						const equippedMark = equippedIds.has(c.cosmeticId) ? COSMETIC_EQUIPPED_MARK : '';
						const minLevel = COSMETIC_TIER_MIN_LEVEL[c.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL];
						const lock = has ? '' : COSMETIC_LOCK(minLevel);
						return COSMETIC_ENTRY(c.cosmeticId, c.displayName, c.category, c.tier) + equippedMark + lock;
					})
					.join('\n') +
				COSMETIC_LIST_FOOTER
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
			if (!character) return COSMETIC_NO_CHARACTER;
			const [catalog] = await tx
				.select()
				.from(cosmeticCatalog)
				.where(eq(cosmeticCatalog.cosmeticId, cosmeticId))
				.limit(1);
			if (!catalog) return COSMETIC_NOT_FOUND;
			const minLevel = COSMETIC_TIER_MIN_LEVEL[catalog.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL];
			const [owned] = await tx
				.select()
				.from(userCosmetics)
				.where(and(eq(userCosmetics.discordId, discordId), eq(userCosmetics.cosmeticId, cosmeticId)))
				.limit(1);
			if (!owned) return COSMETIC_NOT_OWNED(catalog.tier, minLevel);
			// Tier gate is enforced here, not just displayed: believer < chosen < eternal.
			if (character.believerLevel < minLevel)
				return COSMETIC_TIER_LOCKED(catalog.tier, minLevel, character.believerLevel);
			await tx
				.insert(equippedSkins)
				.values({ discordId, category: catalog.category, cosmeticId })
				.onConflictDoUpdate({
					target: [equippedSkins.discordId, equippedSkins.category],
					set: { cosmeticId, updatedAt: new Date() },
				});
			return COSMETIC_EQUIPPED(catalog.displayName, catalog.category);
		});
	}

	async listTitles(discordId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1);
			if (!character) return COSMETIC_NO_CHARACTER;
			const catalog = await tx.select().from(titleCatalog).orderBy(titleCatalog.titleId);
			const owned = await tx.select().from(userTitles).where(eq(userTitles.discordId, discordId));
			const ownedIds = new Set(owned.map((o) => o.titleId));
			return (
				TITLE_LIST_HEADER +
				'\n' +
				catalog
					.map((t) => {
						const ownedMark = ownedIds.has(t.titleId)
							? character.equippedTitleId === t.titleId
								? TITLE_EQUIPPED_MARK
								: ''
							: TITLE_LOCK_MARK;
						return TITLE_ENTRY(t.titleId, t.display) + ownedMark + ` — ${t.howTo}`;
					})
					.join('\n') +
				TITLE_LIST_FOOTER
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
			if (!character) return COSMETIC_NO_CHARACTER;
			if (titleId === 0) {
				await tx
					.update(userCharacter)
					.set({ equippedTitleId: null })
					.where(eq(userCharacter.discordId, discordId));
				return TITLE_REMOVED;
			}
			const [owned] = await tx
				.select()
				.from(userTitles)
				.where(and(eq(userTitles.discordId, discordId), eq(userTitles.titleId, titleId)))
				.limit(1);
			if (!owned) return TITLE_NOT_OWNED;
			await tx
				.update(userCharacter)
				.set({ equippedTitleId: titleId })
				.where(eq(userCharacter.discordId, discordId));
			return TITLE_EQUIPPED;
		});
	}
}
