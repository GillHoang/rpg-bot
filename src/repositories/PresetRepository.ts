import type { Executor } from '../db/client.js';
import { userPresets } from '../db/schema.js';

/**
 * Ported from engine/loadout.js's createPresets: every new character gets
 * two loadout slots — "Main" (pre-equipped with the starter gear) and an
 * empty "Preset 2".
 */
export class PresetRepository {
	async createDefaultPresets(
		executor: Executor,
		discordId: string,
		starterGear: { weaponId: string; armorId: string },
	): Promise<void> {
		await executor.insert(userPresets).values({
			discordId,
			slot: 1,
			name: 'Main',
			equippedWeaponId: starterGear.weaponId,
			equippedArmorId: starterGear.armorId,
		});

		await executor.insert(userPresets).values({ discordId, slot: 2, name: 'Preset 2' });
	}
}
