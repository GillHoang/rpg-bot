import { and, eq, ilike, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db/client.js';
import {
	userCharacter,
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

	/** Số dòng của một category — dùng cho tổng trang khi phân trang. */
	async count(id: string, category: string): Promise<number> {
		const table =
			category === 'weapons'
				? userWeapons
				: category === 'armors'
					? userArmors
					: category === 'runes'
						? userRunes
						: userDeities;
		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(table)
			.where(eq(table.discordId, id));
		return row?.count ?? 0;
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

	// --- Autocomplete: tìm theo tên (hoặc ID) cho /equip, /enhance, /socket ---

	async searchGear(id: string, query: string): Promise<GearSearchRow[]> {
		const [character] = await db
			.select({ weapon: userCharacter.equippedWeaponId, armor: userCharacter.equippedArmorId })
			.from(userCharacter)
			.where(eq(userCharacter.discordId, id))
			.limit(1);
		const pattern = `%${query}%`;
		const match = (name: AnyPgColumn, column: AnyPgColumn) => or(ilike(name, pattern), ilike(column, pattern));
		const weapons = await db
			.select({ id: userWeapons.weaponId, name: weaponRoster.name, tier: weaponRoster.tier, plus: userWeapons.enhancement })
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.where(and(eq(userWeapons.discordId, id), match(weaponRoster.name, userWeapons.weaponId)))
			.orderBy(userWeapons.weaponId)
			.limit(25);
		const armors = await db
			.select({ id: userArmors.armorId, name: armorRoster.name, tier: armorRoster.tier, plus: userArmors.enhancement })
			.from(userArmors)
			.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
			.where(and(eq(userArmors.discordId, id), match(armorRoster.name, userArmors.armorId)))
			.orderBy(userArmors.armorId)
			.limit(25);
		const rows: GearSearchRow[] = [
			...weapons.map((w) => ({ ...w, plus: w.plus - 1, equipped: w.id === character?.weapon })),
			...armors.map((a) => ({ ...a, plus: a.plus - 1, equipped: a.id === character?.armor })),
		];
		return rows.slice(0, 25);
	}

	async searchDeities(id: string, query: string): Promise<DeitySearchRow[]> {
		const pattern = `%${query}%`;
		return db
			.select({
				id: userDeities.userDeityId,
				name: deityRoster.name,
				tier: deityRoster.tier,
			})
			.from(userDeities)
			.innerJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
			.where(
				and(
					eq(userDeities.discordId, id),
					or(ilike(deityRoster.name, pattern), sql`${userDeities.userDeityId}::text ilike ${pattern}`),
				),
			)
			.orderBy(userDeities.userDeityId)
			.limit(25);
	}

	async searchRunes(id: string, query: string): Promise<RuneSearchRow[]> {
		const pattern = `%${query}%`;
		return db
			.select({
				uid: userRunes.runeUid,
				name: runeRoster.name,
				tier: runeRoster.tier,
				socketedInto: userRunes.socketedInto,
			})
			.from(userRunes)
			.innerJoin(runeRoster, eq(userRunes.runeId, runeRoster.runeId))
			.where(and(eq(userRunes.discordId, id), or(ilike(runeRoster.name, pattern), ilike(userRunes.runeUid, pattern))))
			// Free runes first — that is what /socket equip is looking for.
			.orderBy(sql`${userRunes.socketedInto} is null desc`, userRunes.runeUid)
			.limit(25);
	}
}

export interface GearSearchRow {
	id: string;
	name: string;
	tier: string;
	/** Cấp enhance - 1 (hiển thị dạng +N, khớp /inventory). */
	plus: number;
	equipped: boolean;
}

export interface DeitySearchRow {
	id: number;
	name: string;
	tier: string;
}

export interface RuneSearchRow {
	uid: string;
	name: string;
	tier: string;
	socketedInto: string | null;
}
