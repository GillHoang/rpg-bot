import { and, eq, inArray } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import {
	armorRoster,
	weaponRoster,
	runeRoster,
	userArmors,
	userWeapons,
	userRunes,
	usersBag,
	essenceBagDef,
	gameLogs,
} from '../db/schema.js';

/** Loot persistence only; selection, random rolls and presentation belong to the grant service. */
export class LootRepository {
	async lockBag(tx: Executor, id: string) {
		return (await tx.select().from(usersBag).where(eq(usersBag.discordId, id)).for('update'))[0];
	}
	async bags(tx: Executor) {
		return tx.select().from(essenceBagDef).orderBy(essenceBagDef.bagKey);
	}
	async findRunePool(tx: Executor, filter: { tier?: string; names?: string[] }) {
		return tx
			.select()
			.from(runeRoster)
			.where(
				and(
					eq(runeRoster.isAvailable, true),
					filter.tier ? eq(runeRoster.tier, filter.tier) : inArray(runeRoster.name, filter.names ?? []),
				),
			)
			.orderBy(runeRoster.runeId);
	}
	async insertRune(tx: Executor, values: typeof userRunes.$inferInsert) {
		return tx.insert(userRunes).values(values);
	}
	async findWeaponPool(tx: Executor, tier: string) {
		return tx
			.select()
			.from(weaponRoster)
			.where(and(eq(weaponRoster.tier, tier), eq(weaponRoster.isAvailable, true)))
			.orderBy(weaponRoster.weaponRosterId);
	}
	async insertWeapon(tx: Executor, values: typeof userWeapons.$inferInsert) {
		return tx.insert(userWeapons).values(values);
	}
	async findArmorPool(tx: Executor, tier: string) {
		return tx
			.select()
			.from(armorRoster)
			.where(and(eq(armorRoster.tier, tier), eq(armorRoster.isAvailable, true)))
			.orderBy(armorRoster.armorRosterId);
	}
	async insertArmor(tx: Executor, values: typeof userArmors.$inferInsert) {
		return tx.insert(userArmors).values(values);
	}
	async log(tx: Executor, id: string, action: string, before: number, after: number) {
		await tx.insert(gameLogs).values({ discordId: id, action, previousCredux: before, updatedCredux: after });
	}
}
