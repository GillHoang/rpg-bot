import { and, eq } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import {
	cosmeticCatalog,
	equippedSkins,
	titleCatalog,
	userCharacter,
	userCosmetics,
	userTitles,
} from '../../../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class CosmeticRepository {
	async findCosmeticByKey(executor: Executor, cosmeticKey: string) {
		return executor.select().from(cosmeticCatalog).where(eq(cosmeticCatalog.cosmeticKey, cosmeticKey)).limit(1);
	}

	async insertOwnedCosmetic(executor: Executor, values: typeof userCosmetics.$inferInsert) {
		return executor.insert(userCosmetics).values(values).onConflictDoNothing().returning();
	}

	async listBaseCosmetics(executor: Executor) {
		return executor.select().from(cosmeticCatalog).where(eq(cosmeticCatalog.isBase, true));
	}

	async insertBaseCosmetic(executor: Executor, values: typeof userCosmetics.$inferInsert) {
		return executor.insert(userCosmetics).values(values).onConflictDoNothing();
	}

	async insertBaseSkin(executor: Executor, values: typeof equippedSkins.$inferInsert) {
		return executor.insert(equippedSkins).values(values).onConflictDoNothing();
	}

	async findTitleByCode(executor: Executor, code: string) {
		return executor.select().from(titleCatalog).where(eq(titleCatalog.code, code)).limit(1);
	}

	async insertOwnedTitle(executor: Executor, values: typeof userTitles.$inferInsert) {
		return executor.insert(userTitles).values(values).onConflictDoNothing().returning();
	}

	async findCharacter(executor: Executor, discordId: string) {
		return executor.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1);
	}

	async listCosmetics(executor: Executor) {
		return executor.select().from(cosmeticCatalog).orderBy(cosmeticCatalog.cosmeticId);
	}

	async listOwnedCosmetics(executor: Executor, discordId: string) {
		return executor.select().from(userCosmetics).where(eq(userCosmetics.discordId, discordId));
	}

	async listEquippedSkins(executor: Executor, discordId: string) {
		return executor.select().from(equippedSkins).where(eq(equippedSkins.discordId, discordId));
	}

	async findCosmeticById(executor: Executor, cosmeticId: number) {
		return executor.select().from(cosmeticCatalog).where(eq(cosmeticCatalog.cosmeticId, cosmeticId)).limit(1);
	}

	async findOwnedCosmetic(executor: Executor, discordId: string, cosmeticId: number) {
		return executor
			.select()
			.from(userCosmetics)
			.where(and(eq(userCosmetics.discordId, discordId), eq(userCosmetics.cosmeticId, cosmeticId)))
			.limit(1);
	}

	async upsertEquippedSkin(
		executor: Executor,
		cosmeticId: number,
		updatedAt: Date,
		values: typeof equippedSkins.$inferInsert,
	) {
		return executor
			.insert(equippedSkins)
			.values(values)
			.onConflictDoUpdate({
				target: [equippedSkins.discordId, equippedSkins.category],
				set: { cosmeticId, updatedAt: updatedAt },
			});
	}

	async listTitles(executor: Executor) {
		return executor.select().from(titleCatalog).orderBy(titleCatalog.titleId);
	}

	async listOwnedTitles(executor: Executor, discordId: string) {
		return executor.select().from(userTitles).where(eq(userTitles.discordId, discordId));
	}

	async updateEquippedTitle(
		executor: Executor,
		discordId: string,
		values: Partial<typeof userCharacter.$inferInsert>,
	) {
		return executor.update(userCharacter).set(values).where(eq(userCharacter.discordId, discordId));
	}

	async findOwnedTitle(executor: Executor, discordId: string, titleId: number) {
		return executor
			.select()
			.from(userTitles)
			.where(and(eq(userTitles.discordId, discordId), eq(userTitles.titleId, titleId)))
			.limit(1);
	}
}
