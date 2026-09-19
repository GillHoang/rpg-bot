import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
	usersBag,
	userWeapons,
	userArmors,
	weaponRoster,
	armorRoster,
	userRunes,
	runeRoster,
	userDeities,
	deityRoster,
} from '../db/schema.js';
import { computeSigilStats } from '../config/ascension.js';
import {
	ARMOR_LIST_LINE,
	DEITY_LIST_LINE,
	RUNE_LIST_LINE,
	RUNE_NOT_SOCKETED,
	WEAPON_LIST_LINE,
} from '../text/inventory.js';

export class InventoryRepository {
	async bag(id: string) {
		return (await db.select().from(usersBag).where(eq(usersBag.discordId, id)))[0] ?? null;
	}
	async list(id: string, category: string, page: number): Promise<string[]> {
		const offset = (page - 1) * 8;
		if (category === 'weapons')
			return (
				await db
					.select()
					.from(userWeapons)
					.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
					.where(eq(userWeapons.discordId, id))
					.orderBy(userWeapons.weaponId)
					.limit(8)
					.offset(offset)
			).map(({ user_weapons: w, weapon_roster: r }) =>
				WEAPON_LIST_LINE({
					name: r.name,
					tier: r.tier,
					plus: w.enhancement - 1,
					id: w.weaponId,
					atk: w.currAtk,
					crit: w.crit,
					native: JSON.stringify(w.nativeSockets),
					opposite: JSON.stringify(w.oppositeSockets),
				}),
			);
		if (category === 'armors')
			return (
				await db
					.select()
					.from(userArmors)
					.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
					.where(eq(userArmors.discordId, id))
					.orderBy(userArmors.armorId)
					.limit(8)
					.offset(offset)
			).map(({ user_armors: a, armor_roster: r }) =>
				ARMOR_LIST_LINE({
					name: r.name,
					tier: r.tier,
					plus: a.enhancement - 1,
					id: a.armorId,
					hp: a.currHp,
					def: a.currDef,
					native: JSON.stringify(a.nativeSockets),
					opposite: JSON.stringify(a.oppositeSockets),
				}),
			);
		if (category === 'runes')
			return (
				await db
					.select()
					.from(userRunes)
					.innerJoin(runeRoster, eq(userRunes.runeId, runeRoster.runeId))
					.where(eq(userRunes.discordId, id))
					.orderBy(userRunes.runeUid)
					.limit(8)
					.offset(offset)
			).map(({ user_runes: u, rune_roster: r }) =>
				RUNE_LIST_LINE({
					name: r.name,
					tier: r.tier,
					lane: r.lane,
					uid: u.runeUid,
					description: r.description,
					socketedInto: u.socketedInto ?? RUNE_NOT_SOCKETED,
				}),
			);
		return (
			await db
				.select()
				.from(userDeities)
				.innerJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
				.where(and(eq(userDeities.discordId, id)))
				.orderBy(userDeities.userDeityId)
				.limit(8)
				.offset(offset)
		).map(({ user_deities: u, deity_roster: r }) => {
			const s = computeSigilStats({ atk: r.baseAtk, hp: r.baseHp, def: r.baseDef }, u.sigils);
			return DEITY_LIST_LINE({
				name: r.name,
				tier: r.tier,
				userDeityId: u.userDeityId,
				sigils: u.sigils,
				ascended: u.ascended,
				atk: s.atk,
				hp: s.hp,
				def: s.def,
			});
		});
	}
}
