import type { Executor } from '../db/client.js';
import { and, eq } from 'drizzle-orm';
import { usersBag, userWeapons, userArmors, weaponRoster, armorRoster, socketUnlockCost } from '../db/schema.js';

/** Named persistence operations; callers supply the exact executor and business decisions. */
export class SocketStateRepository {
	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}

	async findWeaponTier(tx: Executor, gearId: string) {
		return tx
			.select({ tier: weaponRoster.tier })
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.where(eq(userWeapons.weaponId, gearId));
	}

	async findArmorTier(tx: Executor, gearId: string) {
		return tx
			.select({ tier: armorRoster.tier })
			.from(userArmors)
			.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
			.where(eq(userArmors.armorId, gearId));
	}

	async findUnlockCost(tx: Executor, tier: string, slotIndex: number) {
		return tx
			.select()
			.from(socketUnlockCost)
			.where(and(eq(socketUnlockCost.tier, tier), eq(socketUnlockCost.slotIndex, slotIndex)));
	}

	async updateBag(tx: Executor, discordId: string, values: Partial<typeof usersBag.$inferInsert>) {
		return tx.update(usersBag).set(values).where(eq(usersBag.discordId, discordId));
	}
}
