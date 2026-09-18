import { eq, and } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { weaponRoster, armorRoster, userWeapons, userArmors } from '../db/schema.js';

export interface WeaponCurrStats {
	currAtk: number;
	crit: number;
}

export interface ArmorCurrStats {
	currHp: number;
	currDef: number;
}

export interface GearSocketInfo {
	kind: 'weapon' | 'armor';
	nativeSockets: Array<string | null>;
	oppositeSockets: Array<string | null>;
}

export class GearRepository {
	findWeaponRosterIdByName(executor: Executor, name: string): number | null {
		const row = executor.select().from(weaponRoster).where(eq(weaponRoster.name, name)).get();
		return row?.weaponRosterId ?? null;
	}

	findArmorRosterIdByName(executor: Executor, name: string): number | null {
		const row = executor.select().from(armorRoster).where(eq(armorRoster.name, name)).get();
		return row?.armorRosterId ?? null;
	}

	/** Read the equipped weapon's current ATK/CRIT (post-enhancement), for stat assembly. */
	findWeaponCurrStats(executor: Executor, discordId: string, weaponId: string): WeaponCurrStats | null {
		const row = executor
			.select({ currAtk: userWeapons.currAtk, crit: userWeapons.crit })
			.from(userWeapons)
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)))
			.get();
		return row ?? null;
	}

	/** Read the equipped armor's current HP/DEF (post-enhancement), for stat assembly. */
	findArmorCurrStats(executor: Executor, discordId: string, armorId: string): ArmorCurrStats | null {
		const row = executor
			.select({ currHp: userArmors.currHp, currDef: userArmors.currDef })
			.from(userArmors)
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, armorId)))
			.get();
		return row ?? null;
	}

	/** Locate a gear id in either table for socketing purposes (kind + current socket arrays). */
	findSocketInfo(executor: Executor, discordId: string, gearId: string): GearSocketInfo | null {
		const weapon = executor
			.select({ nativeSockets: userWeapons.nativeSockets, oppositeSockets: userWeapons.oppositeSockets })
			.from(userWeapons)
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)))
			.get();
		if (weapon) {
			return {
				kind: 'weapon',
				nativeSockets: (weapon.nativeSockets as Array<string | null>) ?? [],
				oppositeSockets: (weapon.oppositeSockets as Array<string | null>) ?? [],
			};
		}
		const armor = executor
			.select({ nativeSockets: userArmors.nativeSockets, oppositeSockets: userArmors.oppositeSockets })
			.from(userArmors)
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)))
			.get();
		if (armor) {
			return {
				kind: 'armor',
				nativeSockets: (armor.nativeSockets as Array<string | null>) ?? [],
				oppositeSockets: (armor.oppositeSockets as Array<string | null>) ?? [],
			};
		}
		return null;
	}

	writeNativeSockets(
		executor: Executor,
		discordId: string,
		gearId: string,
		kind: 'weapon' | 'armor',
		sockets: Array<string | null>,
	): void {
		if (kind === 'weapon') {
			executor
				.update(userWeapons)
				.set({ nativeSockets: sockets })
				.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)))
				.run();
		} else {
			executor
				.update(userArmors)
				.set({ nativeSockets: sockets })
				.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)))
				.run();
		}
	}

	/** Clears `runeUid` from whichever gear+array it currently occupies (native or opposite), if any. Used to auto-unsocket before re-socketing elsewhere. */
	clearRuneFromAnyGear(executor: Executor, discordId: string, gearId: string, runeUid: string): void {
		const info = this.findSocketInfo(executor, discordId, gearId);
		if (!info) return;
		const nativeIdx = info.nativeSockets.indexOf(runeUid);
		if (nativeIdx >= 0) {
			const next = [...info.nativeSockets];
			next[nativeIdx] = null;
			this.writeNativeSockets(executor, discordId, gearId, info.kind, next);
		}
	}

	/** Weapons are ATK + CRIT only (v5 stat split). */
	grantWeapon(
		executor: Executor,
		params: { discordId: string; weaponId: string; weaponRosterId: number; atk: number; crit: number },
	): void {
		executor
			.insert(userWeapons)
			.values({
				discordId: params.discordId,
				weaponId: params.weaponId,
				weaponRosterId: params.weaponRosterId,
				currAtk: params.atk,
				baseAtk: params.atk,
				crit: params.crit,
				enhancement: 1,
				isLocked: false,
				nativeSockets: [],
				oppositeSockets: [],
			})
			.run();
	}

	/** Armor is HP + DEF only (v5 stat split). */
	grantArmor(
		executor: Executor,
		params: { discordId: string; armorId: string; armorRosterId: number; hp: number; def: number },
	): void {
		executor
			.insert(userArmors)
			.values({
				discordId: params.discordId,
				armorId: params.armorId,
				armorRosterId: params.armorRosterId,
				currHp: params.hp,
				currDef: params.def,
				baseHp: params.hp,
				baseDef: params.def,
				enhancement: 1,
				isLocked: false,
				nativeSockets: [],
				oppositeSockets: [],
			})
			.run();
	}
}
