import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { LoadoutRepository } from '../repositories/LoadoutRepository.js';
import type { userPresets } from '../db/schema.js';
import type { Executor } from '../db/client.js';
import { logger } from '../utils/logger.js';
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

type PresetRow = typeof userPresets.$inferSelect;

export interface LoadoutDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		LoadoutRepository,
		| 'lockCharacter'
		| 'findPreset'
		| 'findOwnedWeapon'
		| 'updatePreset'
		| 'updateCharacter'
		| 'findOwnedArmor'
		| 'findOwnedDeity'
	>;
}

/**
 * Facade cho /equip và /preset switch. Deity nhận slot 1/2/3 (kind:
 * deity|deity2|deity3) — pantheon M7. Wording nằm ở src/text/loadout.ts.
 */

export class LoadoutService {
	private readonly persistence: PersistenceContext;
	private readonly queries: Pick<
		LoadoutRepository,
		| 'lockCharacter'
		| 'findPreset'
		| 'findOwnedWeapon'
		| 'updatePreset'
		| 'updateCharacter'
		| 'findOwnedArmor'
		| 'findOwnedDeity'
	>;

	constructor(options: LoadoutDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.queries = options.queries ?? new LoadoutRepository();
	}
	async equip(id: string, kind: string, item: string, slot?: number): Promise<string> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.lockCharacter(tx, id);
			if (!character) return LOADOUT_NO_CHARACTER;
			const target = slot ?? character.activePresetSlot;
			if (target !== 1 && target !== 2) return LOADOUT_BAD_PRESET;
			const [preset] = await this.queries.findPreset(tx, id, target);
			if (!preset) return LOADOUT_PRESET_MISSING;

			let error: string | null;
			if (kind === 'weapon') error = await this.equipWeapon(tx, id, preset, item);
			else if (kind === 'armor') error = await this.equipArmor(tx, id, preset, item);
			else if (/^deity[123]?$/.test(kind)) {
				error = await this.equipDeity(tx, id, preset, kind, item);
			} else return LOADOUT_INVALID_KIND;
			if (error) return error;
			logger.info({ user: id, kind, item, preset: target }, 'gear-equipped');
			return LOADOUT_EQUIPPED(kind, item, target);
		});
	}

	private async equipWeapon(tx: Executor, id: string, preset: PresetRow, item: string): Promise<string | null> {
		const [owned] = await this.queries.findOwnedWeapon(tx, id, item);
		if (!owned) return LOADOUT_WEAPON_NOT_OWNED;
		await this.queries.updatePreset(tx, preset.id, { equippedWeaponId: item, updatedAt: new Date() });
		return null;
	}

	private async equipArmor(tx: Executor, id: string, preset: PresetRow, item: string): Promise<string | null> {
		const [owned] = await this.queries.findOwnedArmor(tx, id, item);
		if (!owned) return LOADOUT_ARMOR_NOT_OWNED;
		await this.queries.updatePreset(tx, preset.id, { equippedArmorId: item, updatedAt: new Date() });
		return null;
	}

	private async equipDeity(
		tx: Executor,
		id: string,
		preset: PresetRow,
		kind: string,
		item: string,
	): Promise<string | null> {
		if (!/^\d+$/.test(item) || !Number.isSafeInteger(Number(item))) return LOADOUT_INVALID_KIND;
		const userDeityId = Number(item);
		const [owned] = await this.queries.findOwnedDeity(tx, id, userDeityId);
		if (!owned) return LOADOUT_DEITY_NOT_OWNED;
		const slotIndex = kind === 'deity' ? 1 : Number(kind.slice(5));
		const column = `equippedDeity${slotIndex}Id` as 'equippedDeity1Id' | 'equippedDeity2Id' | 'equippedDeity3Id';
		// One deity cannot hold two pantheon slots at once.
		const slots = [preset.equippedDeity1Id, preset.equippedDeity2Id, preset.equippedDeity3Id];
		if (slots.includes(userDeityId) && slots[slotIndex - 1] !== userDeityId) return LOADOUT_DEITY_IN_OTHER_SLOT;
		await this.queries.updatePreset(tx, preset.id, { [column]: userDeityId, updatedAt: new Date() });
		return null;
	}

	async switch(id: string, slot: number): Promise<string> {
		if (slot !== 1 && slot !== 2) return LOADOUT_BAD_PRESET;
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.lockCharacter(tx, id);
			if (!character) return LOADOUT_NO_CHARACTER;
			const [preset] = await this.queries.findPreset(tx, id, slot);
			if (!preset) return LOADOUT_PRESET_MISSING;
			await this.queries.updateCharacter(tx, id, {
				activePresetSlot: slot,
			});
			logger.info({ user: id, preset: slot }, 'preset-switched');
			return LOADOUT_SWITCHED(
				slot,
				preset.equippedWeaponId ?? LOADOUT_EMPTY,
				preset.equippedArmorId ?? LOADOUT_EMPTY,
				preset.equippedDeity1Id != null ? String(preset.equippedDeity1Id) : LOADOUT_EMPTY,
			);
		});
	}
}
