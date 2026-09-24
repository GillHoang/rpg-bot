import { and, eq, inArray } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
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
} from '../../../db/schema.js';

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
	/**
	 * One audit row per loot mutation with every touched counter, so a
	 * "opened chest but got nothing" complaint can be replayed from the DB:
	 * credux/shards/chest deltas always, essence/relic deltas when nonzero.
	 */
	async logLedger(
		tx: Executor,
		input: {
			discordId: string;
			action: string;
			itemType?: string;
			credux?: readonly [number, number];
			shards?: readonly [number, number];
			chest?: readonly [number, number];
			essence?: readonly [number, number];
			relic?: readonly [number, number];
		},
	): Promise<void> {
		await tx.insert(gameLogs).values({
			discordId: input.discordId,
			action: input.action,
			itemType: input.itemType ?? null,
			previousCredux: input.credux?.[0] ?? null,
			updatedCredux: input.credux?.[1] ?? null,
			previousBeliefShards: input.shards?.[0] ?? null,
			updatedBeliefShards: input.shards?.[1] ?? null,
			previousChestCount: input.chest?.[0] ?? null,
			updatedChestCount: input.chest?.[1] ?? null,
			previousEssenceCount: input.essence?.[0] ?? null,
			updatedEssenceCount: input.essence?.[1] ?? null,
			previousRelicCount: input.relic?.[0] ?? null,
			updatedRelicCount: input.relic?.[1] ?? null,
		});
	}
}
