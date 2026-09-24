import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import { defaultPersistence } from '../../../db/defaultPersistence.js';
import { CosmeticRepository } from '../infrastructure/CosmeticRepository.js';
import type { Executor } from '../../../db/client.js';

import { COSMETIC_TIER_MIN_LEVEL } from '../../../shared/config/reputation.js';
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
} from '../../../shared/ui/text/cosmetic.js';

export interface CosmeticDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		CosmeticRepository,
		| 'findCosmeticByKey'
		| 'insertOwnedCosmetic'
		| 'listBaseCosmetics'
		| 'insertBaseCosmetic'
		| 'insertBaseSkin'
		| 'findTitleByCode'
		| 'insertOwnedTitle'
		| 'findCharacter'
		| 'listCosmetics'
		| 'listOwnedCosmetics'
		| 'listEquippedSkins'
		| 'findCosmeticById'
		| 'findOwnedCosmetic'
		| 'upsertEquippedSkin'
		| 'listTitles'
		| 'listOwnedTitles'
		| 'updateEquippedTitle'
		| 'findOwnedTitle'
	>;
}

/**
 * Cosmetic + title (M7). Catalog nằm trong seed; equip lưu xuống
 * equipped_skins / user_character.equipped_title_id. Cosmetic tier gate theo
 * believer level (config/reputation.ts). Grant helpers dùng được trong tx —
 * Duel/Ranked/Raid/PvpShop gọi trực tiếp, command dùng facade ngoài tx.
 * Wording nằm ở src/shared/ui/text/cosmetic.ts.
 */

export class CosmeticService {
	private readonly persistence: PersistenceContext;
	private readonly queries: NonNullable<CosmeticDependencies['queries']>;
	constructor(options: CosmeticDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.queries = options.queries ?? new CosmeticRepository();
	}
	// --- In-tx grant helpers (used by other services) ---

	async grantCosmeticInTx(tx: Executor, discordId: string, cosmeticKey: string, source: string): Promise<boolean> {
		const [catalog] = await this.queries.findCosmeticByKey(tx, cosmeticKey);
		if (!catalog) throw new Error(COSMETIC_SEED_MISSING(cosmeticKey));
		const [row] = await this.queries.insertOwnedCosmetic(tx, { discordId, cosmeticId: catalog.cosmeticId, source });
		return row != null;
	}

	/** Base cosmetics auto-granted (and equipped) when a character is created. */
	async grantBaseInTx(tx: Executor, discordId: string): Promise<void> {
		const bases = await this.queries.listBaseCosmetics(tx);
		for (const base of bases) {
			await this.queries.insertBaseCosmetic(tx, { discordId, cosmeticId: base.cosmeticId, source: 'base' });
			await this.queries.insertBaseSkin(tx, { discordId, category: base.category, cosmeticId: base.cosmeticId });
		}
	}

	async grantTitleInTx(tx: Executor, discordId: string, code: string): Promise<boolean> {
		const [catalog] = await this.queries.findTitleByCode(tx, code);
		if (!catalog) throw new Error(TITLE_SEED_MISSING(code));
		const [row] = await this.queries.insertOwnedTitle(tx, { discordId, titleId: catalog.titleId });
		return row != null;
	}

	// --- Command facades ---

	async listCosmetics(discordId: string): Promise<string> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.findCharacter(tx, discordId);
			if (!character) return COSMETIC_NO_CHARACTER;
			const catalog = await this.queries.listCosmetics(tx);
			const owned = await this.queries.listOwnedCosmetics(tx, discordId);
			const equipped = await this.queries.listEquippedSkins(tx, discordId);
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
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.findCharacter(tx, discordId);
			if (!character) return COSMETIC_NO_CHARACTER;
			const [catalog] = await this.queries.findCosmeticById(tx, cosmeticId);
			if (!catalog) return COSMETIC_NOT_FOUND;
			const minLevel = COSMETIC_TIER_MIN_LEVEL[catalog.tier as keyof typeof COSMETIC_TIER_MIN_LEVEL];
			const [owned] = await this.queries.findOwnedCosmetic(tx, discordId, cosmeticId);
			if (!owned) return COSMETIC_NOT_OWNED(catalog.tier, minLevel);
			// Tier gate is enforced here, not just displayed: believer < chosen < eternal.
			if (character.believerLevel < minLevel)
				return COSMETIC_TIER_LOCKED(catalog.tier, minLevel, character.believerLevel);
			await this.queries.upsertEquippedSkin(tx, cosmeticId, new Date(), {
				discordId,
				category: catalog.category,
				cosmeticId,
			});
			return COSMETIC_EQUIPPED(catalog.displayName, catalog.category);
		});
	}

	async listTitles(discordId: string): Promise<string> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.findCharacter(tx, discordId);
			if (!character) return COSMETIC_NO_CHARACTER;
			const catalog = await this.queries.listTitles(tx);
			const owned = await this.queries.listOwnedTitles(tx, discordId);
			const ownedIds = new Set(owned.map((o) => o.titleId));
			return (
				TITLE_LIST_HEADER +
				'\n' +
				catalog
					.map((t) => {
						let ownedMark = TITLE_LOCK_MARK;
						if (ownedIds.has(t.titleId)) {
							ownedMark = character.equippedTitleId === t.titleId ? TITLE_EQUIPPED_MARK : '';
						}
						return TITLE_ENTRY(t.titleId, t.display) + ownedMark + ` — ${t.howTo}`;
					})
					.join('\n') +
				TITLE_LIST_FOOTER
			);
		});
	}

	async equipTitle(discordId: string, titleId: number): Promise<string> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.findCharacter(tx, discordId);
			if (!character) return COSMETIC_NO_CHARACTER;
			if (titleId === 0) {
				await this.queries.updateEquippedTitle(tx, discordId, { equippedTitleId: null });
				return TITLE_REMOVED;
			}
			const [owned] = await this.queries.findOwnedTitle(tx, discordId, titleId);
			if (!owned) return TITLE_NOT_OWNED;
			await this.queries.updateEquippedTitle(tx, discordId, { equippedTitleId: titleId });
			return TITLE_EQUIPPED;
		});
	}
}
