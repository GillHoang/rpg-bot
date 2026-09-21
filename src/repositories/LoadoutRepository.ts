import type { Executor } from '../db/client.js';
import { and, eq } from 'drizzle-orm';
import { userCharacter, userPresets, userWeapons, userArmors, userDeities } from '../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class LoadoutRepository {
	async lockCharacter(tx: Executor, discordId: string) {
		return tx.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).for('update');
	}

	async findPreset(tx: Executor, discordId: string, slot: number) {
		return tx
			.select()
			.from(userPresets)
			.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, slot)));
	}

	async findOwnedWeapon(tx: Executor, discordId: string, itemId: string) {
		return tx
			.select()
			.from(userWeapons)
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, itemId)));
	}

	async updatePreset(tx: Executor, presetId: number, values: Partial<typeof userPresets.$inferInsert>) {
		return tx.update(userPresets).set(values).where(eq(userPresets.id, presetId));
	}

	async updateCharacter(tx: Executor, discordId: string, values: Partial<typeof userCharacter.$inferInsert>) {
		return tx.update(userCharacter).set(values).where(eq(userCharacter.discordId, discordId));
	}

	async findOwnedArmor(tx: Executor, discordId: string, itemId: string) {
		return tx
			.select()
			.from(userArmors)
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, itemId)));
	}

	async findOwnedDeity(tx: Executor, discordId: string, userDeityId: number) {
		return tx
			.select()
			.from(userDeities)
			.where(and(eq(userDeities.discordId, discordId), eq(userDeities.userDeityId, userDeityId)));
	}
}
