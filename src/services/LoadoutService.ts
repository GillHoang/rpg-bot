import { and, eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { userCharacter, userPresets, userWeapons, userArmors, userDeities } from '../db/schema.js';
import {
	LOADOUT_ARMOR_NOT_OWNED,
	LOADOUT_BAD_PRESET,
	LOADOUT_DEITY_IN_OTHER_SLOT,
	LOADOUT_DEITY_NOT_OWNED,
	LOADOUT_EMPTY,
	LOADOUT_EQUIPPED,
	LOADOUT_INVALID_KIND,
	LOADOUT_NO_CHARACTER,
	LOADOUT_PRESET_MISSING,
	LOADOUT_SWITCHED,
	LOADOUT_WEAPON_NOT_OWNED,
} from '../text/loadout.js';

type CharacterRow = typeof userCharacter.$inferSelect;
type PresetRow = typeof userPresets.$inferSelect;

/**
 * Facade cho /equip và /preset switch. Deity nhận slot 1/2/3 (kind:
 * deity|deity2|deity3) — pantheon M7. Wording nằm ở src/text/loadout.ts.
 */
export class LoadoutService {
	async equip(id: string, kind: string, item: string, slot?: number): Promise<string> {
		return db.transaction(async (tx) => {
			const [character] = await tx.select().from(userCharacter).where(eq(userCharacter.discordId, id)).for('update');
			if (!character) return LOADOUT_NO_CHARACTER;
			const target = slot ?? character.activePresetSlot;
			if (target !== 1 && target !== 2) return LOADOUT_BAD_PRESET;
			const [preset] = await tx
				.select()
				.from(userPresets)
				.where(and(eq(userPresets.discordId, id), eq(userPresets.slot, target)));
			if (!preset) return LOADOUT_PRESET_MISSING;

			let error: string | null;
			if (kind === 'weapon') error = await this.equipWeapon(tx, id, preset, item, target, character);
			else if (kind === 'armor') error = await this.equipArmor(tx, id, preset, item, target, character);
			else if (/^deity[123]?$/.test(kind)) {
				error = await this.equipDeity(tx, id, preset, kind, item, target, character);
			} else return LOADOUT_INVALID_KIND;
			if (error) return error;
			return LOADOUT_EQUIPPED(kind, item, target);
		});
	}

	private async equipWeapon(
		tx: Executor,
		id: string,
		preset: PresetRow,
		item: string,
		target: number,
		character: CharacterRow,
	): Promise<string | null> {
		const [owned] = await tx
			.select()
			.from(userWeapons)
			.where(and(eq(userWeapons.discordId, id), eq(userWeapons.weaponId, item)));
		if (!owned) return LOADOUT_WEAPON_NOT_OWNED;
		await tx
			.update(userPresets)
			.set({ equippedWeaponId: item, updatedAt: new Date() })
			.where(eq(userPresets.id, preset.id));
		if (target === character.activePresetSlot)
			await tx.update(userCharacter).set({ equippedWeaponId: item }).where(eq(userCharacter.discordId, id));
		return null;
	}

	private async equipArmor(
		tx: Executor,
		id: string,
		preset: PresetRow,
		item: string,
		target: number,
		character: CharacterRow,
	): Promise<string | null> {
		const [owned] = await tx
			.select()
			.from(userArmors)
			.where(and(eq(userArmors.discordId, id), eq(userArmors.armorId, item)));
		if (!owned) return LOADOUT_ARMOR_NOT_OWNED;
		await tx
			.update(userPresets)
			.set({ equippedArmorId: item, updatedAt: new Date() })
			.where(eq(userPresets.id, preset.id));
		if (target === character.activePresetSlot)
			await tx.update(userCharacter).set({ equippedArmorId: item }).where(eq(userCharacter.discordId, id));
		return null;
	}

	private async equipDeity(
		tx: Executor,
		id: string,
		preset: PresetRow,
		kind: string,
		item: string,
		target: number,
		character: CharacterRow,
	): Promise<string | null> {
		if (!/^\d+$/.test(item) || !Number.isSafeInteger(Number(item))) return LOADOUT_INVALID_KIND;
		const userDeityId = Number(item);
		const [owned] = await tx
			.select()
			.from(userDeities)
			.where(and(eq(userDeities.discordId, id), eq(userDeities.userDeityId, userDeityId)));
		if (!owned) return LOADOUT_DEITY_NOT_OWNED;
		const slotIndex = kind === 'deity' ? 1 : Number(kind.slice(5));
		const column = `equippedDeity${slotIndex}Id` as 'equippedDeity1Id' | 'equippedDeity2Id' | 'equippedDeity3Id';
		const activeColumn = `activeDeityId${slotIndex === 1 ? '' : slotIndex}` as
			| 'activeDeityId'
			| 'activeDeityId2'
			| 'activeDeityId3';
		// One deity cannot hold two pantheon slots at once.
		const slots = [preset.equippedDeity1Id, preset.equippedDeity2Id, preset.equippedDeity3Id];
		if (slots.includes(userDeityId) && slots[slotIndex - 1] !== userDeityId) return LOADOUT_DEITY_IN_OTHER_SLOT;
		await tx
			.update(userPresets)
			.set({ [column]: userDeityId, updatedAt: new Date() })
			.where(eq(userPresets.id, preset.id));
		if (target === character.activePresetSlot)
			await tx.update(userCharacter).set({ [activeColumn]: userDeityId }).where(eq(userCharacter.discordId, id));
		return null;
	}

	async switch(id: string, slot: number): Promise<string> {
		if (slot !== 1 && slot !== 2) return LOADOUT_BAD_PRESET;
		return db.transaction(async (tx) => {
			const [character] = await tx.select().from(userCharacter).where(eq(userCharacter.discordId, id)).for('update');
			if (!character) return LOADOUT_NO_CHARACTER;
			const [preset] = await tx
				.select()
				.from(userPresets)
				.where(and(eq(userPresets.discordId, id), eq(userPresets.slot, slot)));
			if (!preset) return LOADOUT_PRESET_MISSING;
			await tx
				.update(userCharacter)
				.set({
					activePresetSlot: slot,
					equippedWeaponId: preset.equippedWeaponId,
					equippedArmorId: preset.equippedArmorId,
					activeDeityId: preset.equippedDeity1Id,
					activeDeityId2: preset.equippedDeity2Id,
					activeDeityId3: preset.equippedDeity3Id,
					activeEchoDeityId: preset.equippedEchoDeityId,
				})
				.where(eq(userCharacter.discordId, id));
			return LOADOUT_SWITCHED(
				slot,
				preset.equippedWeaponId ?? LOADOUT_EMPTY,
				preset.equippedArmorId ?? LOADOUT_EMPTY,
				preset.equippedDeity1Id != null ? String(preset.equippedDeity1Id) : LOADOUT_EMPTY,
			);
		});
	}
}
