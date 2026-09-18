import { eq, and } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userWeapons, weaponRoster, userArmors, armorRoster, usersBag, gameLogs } from '../db/schema.js';
import type { GearTier } from '../config/enhancement.js';

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
	findGear(executor: Executor, discordId: string, gearId: string): EnhanceableGear | null {
		const weapon = executor
			.select({ tier: weaponRoster.tier, enhancement: userWeapons.enhancement, baseAtk: userWeapons.baseAtk })
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)))
			.get();
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

		const armor = executor
			.select({
				tier: armorRoster.tier,
				enhancement: userArmors.enhancement,
				baseHp: userArmors.baseHp,
				baseDef: userArmors.baseDef,
			})
			.from(userArmors)
			.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)))
			.get();
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

	getCredux(executor: Executor, discordId: string): number {
		return executor
			.select({ credux: usersBag.credux })
			.from(usersBag)
			.where(eq(usersBag.discordId, discordId))
			.get()!.credux;
	}

	spendCredux(executor: Executor, discordId: string, amount: number): void {
		const before = this.getCredux(executor, discordId);
		const after = before - amount;
		executor.update(usersBag).set({ credux: after }).where(eq(usersBag.discordId, discordId)).run();
		executor
			.insert(gameLogs)
			.values({ discordId, action: 'Enhance', previousCredux: before, updatedCredux: after })
			.run();
	}

	applyWeaponSuccess(
		executor: Executor,
		discordId: string,
		gearId: string,
		newEnhancement: number,
		newAtk: number,
	): void {
		executor
			.update(userWeapons)
			.set({ enhancement: newEnhancement, currAtk: newAtk })
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)))
			.run();
	}

	applyArmorSuccess(
		executor: Executor,
		discordId: string,
		gearId: string,
		newEnhancement: number,
		newHp: number,
		newDef: number,
	): void {
		executor
			.update(userArmors)
			.set({ enhancement: newEnhancement, currHp: newHp, currDef: newDef })
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)))
			.run();
	}
}
