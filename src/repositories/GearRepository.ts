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
	async findWeaponRosterIdByName(executor: Executor, name: string): Promise<number | null> {
		const [row] = await executor.select().from(weaponRoster).where(eq(weaponRoster.name, name)).limit(1);
		return row?.weaponRosterId ?? null;
	}

	async findArmorRosterIdByName(executor: Executor, name: string): Promise<number | null> {
		const [row] = await executor.select().from(armorRoster).where(eq(armorRoster.name, name)).limit(1);
		return row?.armorRosterId ?? null;
	}

	/** Read the equipped weapon's current ATK/CRIT (post-enhancement), for stat assembly. */
	async findWeaponCurrStats(executor: Executor, discordId: string, weaponId: string): Promise<WeaponCurrStats | null> {
		const [row] = await executor
			.select({ currAtk: userWeapons.currAtk, crit: userWeapons.crit })
			.from(userWeapons)
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)))
			.limit(1);
		return row ?? null;
	}

	/** Read the equipped armor's current HP/DEF (post-enhancement), for stat assembly. */
	async findArmorCurrStats(executor: Executor, discordId: string, armorId: string): Promise<ArmorCurrStats | null> {
		const [row] = await executor
			.select({ currHp: userArmors.currHp, currDef: userArmors.currDef })
			.from(userArmors)
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, armorId)))
			.limit(1);
		return row ?? null;
	}

	/** Locate a gear id in either table for socketing purposes (kind + current socket arrays). */
	async findSocketInfo(executor: Executor, discordId: string, gearId: string): Promise<GearSocketInfo | null> {
		const [weapon] = await executor
			.select({ nativeSockets: userWeapons.nativeSockets, oppositeSockets: userWeapons.oppositeSockets })
			.from(userWeapons)
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)))
			.limit(1);
		if (weapon) {
			return {
				kind: 'weapon',
				nativeSockets: (weapon.nativeSockets as Array<string | null>) ?? [],
				oppositeSockets: (weapon.oppositeSockets as Array<string | null>) ?? [],
			};
		}
		const [armor] = await executor
			.select({ nativeSockets: userArmors.nativeSockets, oppositeSockets: userArmors.oppositeSockets })
			.from(userArmors)
			.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)))
			.limit(1);
		if (armor) {
			return {
				kind: 'armor',
				nativeSockets: (armor.nativeSockets as Array<string | null>) ?? [],
				oppositeSockets: (armor.oppositeSockets as Array<string | null>) ?? [],
			};
		}
		return null;
	}

	async writeNativeSockets(
		executor: Executor,
		discordId: string,
		gearId: string,
		kind: 'weapon' | 'armor',
		sockets: Array<string | null>,
	): Promise<void> {
		if (kind === 'weapon') {
			await executor
				.update(userWeapons)
				.set({ nativeSockets: sockets })
				.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, gearId)));
		} else {
			await executor
				.update(userArmors)
				.set({ nativeSockets: sockets })
				.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, gearId)));
		}
	}

	/** Clears `runeUid` from whichever gear+array it currently occupies (native or opposite), if any. Used to auto-unsocket before re-socketing elsewhere. */
	async clearRuneFromAnyGear(executor: Executor, discordId: string, gearId: string, runeUid: string): Promise<void> {
		const info = await this.findSocketInfo(executor, discordId, gearId);
		if (!info) return;
		const nativeIdx = info.nativeSockets.indexOf(runeUid);
		if (nativeIdx >= 0) {
			const next = [...info.nativeSockets];
			next[nativeIdx] = null;
			await this.writeNativeSockets(executor, discordId, gearId, info.kind, next);
		}
	}

	/** Weapons are ATK + CRIT only (v5 stat split). */
	async grantWeapon(
		executor: Executor,
		params: { discordId: string; weaponId: string; weaponRosterId: number; atk: number; crit: number },
	): Promise<void> {
		await executor.insert(userWeapons).values({
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
		});
	}

	/** Armor is HP + DEF only (v5 stat split). */
	async grantArmor(
		executor: Executor,
		params: { discordId: string; armorId: string; armorRosterId: number; hp: number; def: number },
	): Promise<void> {
		await executor.insert(userArmors).values({
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
		});
	}
}
