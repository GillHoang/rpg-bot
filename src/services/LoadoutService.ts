import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
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

/**
 * Facade cho /equip và /preset switch. Deity nhận slot 1/2/3 (kind:
 * deity|deity2|deity3) — pantheon M7. Wording nằm ở src/text/loadout.ts.
 */
export class LoadoutService {
	async equip(id: string, kind: string, item: string, slot?: number): Promise<string> {
		return db.transaction(async (tx) => {
			const [c] = await tx.select().from(userCharacter).where(eq(userCharacter.discordId, id)).for('update');
			if (!c) return LOADOUT_NO_CHARACTER;
			const target = slot ?? c.activePresetSlot;
			if (target !== 1 && target !== 2) return LOADOUT_BAD_PRESET;
			const [preset] = await tx
				.select()
				.from(userPresets)
				.where(and(eq(userPresets.discordId, id), eq(userPresets.slot, target)));
			if (!preset) return LOADOUT_PRESET_MISSING;
			if (kind === 'weapon') {
				const [owned] = await tx
					.select()
					.from(userWeapons)
					.where(and(eq(userWeapons.discordId, id), eq(userWeapons.weaponId, item)));
				if (!owned) return LOADOUT_WEAPON_NOT_OWNED;
				await tx
					.update(userPresets)
					.set({ equippedWeaponId: item, updatedAt: new Date() })
					.where(eq(userPresets.id, preset.id));
				if (target === c.activePresetSlot)
					await tx
						.update(userCharacter)
						.set({ equippedWeaponId: item })
						.where(eq(userCharacter.discordId, id));
			} else if (kind === 'armor') {
				const [owned] = await tx
					.select()
					.from(userArmors)
					.where(and(eq(userArmors.discordId, id), eq(userArmors.armorId, item)));
				if (!owned) return LOADOUT_ARMOR_NOT_OWNED;
				await tx
					.update(userPresets)
					.set({ equippedArmorId: item, updatedAt: new Date() })
					.where(eq(userPresets.id, preset.id));
				if (target === c.activePresetSlot)
					await tx
						.update(userCharacter)
						.set({ equippedArmorId: item })
						.where(eq(userCharacter.discordId, id));
			} else if (/^deity[123]?$/.test(kind) && /^\d+$/.test(item) && Number.isSafeInteger(Number(item))) {
				const userDeityId = Number(item);
				const [owned] = await tx
					.select()
					.from(userDeities)
					.where(and(eq(userDeities.discordId, id), eq(userDeities.userDeityId, userDeityId)));
				if (!owned) return LOADOUT_DEITY_NOT_OWNED;
				const slotIndex = kind === 'deity' ? 1 : Number(kind.slice(5));
				const column = `equippedDeity${slotIndex}Id` as
					'equippedDeity1Id' | 'equippedDeity2Id' | 'equippedDeity3Id';
				const activeColumn = `activeDeityId${slotIndex === 1 ? '' : slotIndex}` as
					'activeDeityId' | 'activeDeityId2' | 'activeDeityId3';
				// One deity cannot hold two pantheon slots at once.
				const slots = [preset.equippedDeity1Id, preset.equippedDeity2Id, preset.equippedDeity3Id];
				if (slots.includes(userDeityId) && slots[slotIndex - 1] !== userDeityId)
					return LOADOUT_DEITY_IN_OTHER_SLOT;
				await tx
					.update(userPresets)
					.set({ [column]: userDeityId, updatedAt: new Date() })
					.where(eq(userPresets.id, preset.id));
				if (target === c.activePresetSlot)
					await tx
						.update(userCharacter)
						.set({ [activeColumn]: userDeityId })
						.where(eq(userCharacter.discordId, id));
			} else return LOADOUT_INVALID_KIND;
			return LOADOUT_EQUIPPED(kind, item, target);
		});
	}
	async switch(id: string, slot: number): Promise<string> {
		if (slot !== 1 && slot !== 2) return LOADOUT_BAD_PRESET;
		return db.transaction(async (tx) => {
			const [c] = await tx.select().from(userCharacter).where(eq(userCharacter.discordId, id)).for('update');
			if (!c) return LOADOUT_NO_CHARACTER;
			const [p] = await tx
				.select()
				.from(userPresets)
				.where(and(eq(userPresets.discordId, id), eq(userPresets.slot, slot)));
			if (!p) return LOADOUT_PRESET_MISSING;
			await tx
				.update(userCharacter)
				.set({
					activePresetSlot: slot,
					equippedWeaponId: p.equippedWeaponId,
					equippedArmorId: p.equippedArmorId,
					activeDeityId: p.equippedDeity1Id,
					activeDeityId2: p.equippedDeity2Id,
					activeDeityId3: p.equippedDeity3Id,
					activeEchoDeityId: p.equippedEchoDeityId,
				})
				.where(eq(userCharacter.discordId, id));
			return LOADOUT_SWITCHED(
				slot,
				p.equippedWeaponId ?? LOADOUT_EMPTY,
				p.equippedArmorId ?? LOADOUT_EMPTY,
				p.equippedDeity1Id != null ? String(p.equippedDeity1Id) : LOADOUT_EMPTY,
			);
		});
	}
}
