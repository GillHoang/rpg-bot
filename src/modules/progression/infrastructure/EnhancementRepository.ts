import { eq, and } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { userWeapons, weaponRoster, userArmors, armorRoster, usersBag, gameLogs } from '../../../db/schema.js';
import type { GearTier } from '../../../shared/config/enhancement.js';

export interface EnhanceableGear {
	kind: 'weapon' | 'armor';
	tier: GearTier;
	enhancement: number;
	baseAtk: number | null;
	baseHp: number | null;
	baseDef: number | null;
}

export class EnhancementRepository {
	/** Looks up a gear id in either table (ids are unique across both — see GearIdGenerator). */
	async findGear(executor: Executor, discordId: string, gearId: string): Promise<EnhanceableGear | null> {
		const [weapon] = await executor
			.select({ tier: weaponRoster.tier, enhancement: userWeapons.enhancement, baseAtk: userWeapons.baseAtk })
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)))
			.limit(1);
		if (weapon) {
			return {
				kind: 'weapon',
				tier: weapon.tier as GearTier,
				enhancement: weapon.enhancement,
				baseAtk: weapon.baseAtk,
				baseHp: null,
				baseDef: null,
			};
		}

		const [armor] = await executor
			.select({
				tier: armorRoster.tier,
				enhancement: userArmors.enhancement,
				baseHp: userArmors.baseHp,
				baseDef: userArmors.baseDef,
			})
			.from(userArmors)
			.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)))
			.limit(1);
		if (armor) {
			return {
				kind: 'armor',
				tier: armor.tier as GearTier,
				enhancement: armor.enhancement,
				baseAtk: null,
				baseHp: armor.baseHp,
				baseDef: armor.baseDef,
			};
		}
		return null;
	}

	async getCredux(executor: Executor, discordId: string): Promise<number> {
		const [row] = await executor
			.select({ credux: usersBag.credux })
			.from(usersBag)
			.where(eq(usersBag.discordId, discordId))
			.limit(1);
		return row.credux;
	}

	async spendCredux(executor: Executor, discordId: string, amount: number): Promise<void> {
		const before = await this.getCredux(executor, discordId);
		const after = before - amount;
		await executor.update(usersBag).set({ credux: after }).where(eq(usersBag.discordId, discordId));
		await executor
			.insert(gameLogs)
			.values({ discordId, action: 'Enhance', previousCredux: before, updatedCredux: after });
	}

	async applyWeaponSuccess(
		executor: Executor,
		discordId: string,
		gearId: string,
		newEnhancement: number,
		newAtk: number,
	): Promise<void> {
		await executor
			.update(userWeapons)
			.set({ enhancement: newEnhancement, currAtk: newAtk })
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)));
	}

	async applyArmorSuccess(
		executor: Executor,
		discordId: string,
		gearId: string,
		newEnhancement: number,
		newHp: number,
		newDef: number,
	): Promise<void> {
		await executor
			.update(userArmors)
			.set({ enhancement: newEnhancement, currHp: newHp, currDef: newDef })
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)));
	}
}
