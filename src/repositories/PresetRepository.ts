import { sql } from 'drizzle-orm';
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
		// Serialize the legacy MAX(id) allocator across different new players.
		await executor.execute(sql`SELECT pg_advisory_xact_lock(42701)`);
		// user_presets.id is a plain PK in the pg schema (not identity, per the
		// schema's own note), so an explicit id is required; allocate two
		// adjacent ids up front (called inside a transaction).
		const [seq] = await executor
			.select({ nextId: sql<number>`COALESCE(MAX(${userPresets.id}), 0) + 1` })
			.from(userPresets);
		const nextId = Number(seq.nextId);

		await executor.insert(userPresets).values({
			id: nextId,
			discordId,
			slot: 1,
			name: 'Main',
			equippedWeaponId: starterGear.weaponId,
			equippedArmorId: starterGear.armorId,
		});

		await executor.insert(userPresets).values({ id: nextId + 1, discordId, slot: 2, name: 'Preset 2' });
	}
}
