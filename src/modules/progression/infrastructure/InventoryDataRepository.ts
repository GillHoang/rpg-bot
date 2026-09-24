import { enhancementPlus } from '../../../shared/utils/enhancementDisplay.js';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db, type Executor } from '../../../db/client.js';
import {
	userCharacter,
	userPresets,
	usersBag,
	userWeapons,
	userArmors,
	weaponRoster,
	armorRoster,
	userRunes,
	runeRoster,
	userDeities,
	deityRoster,
} from '../../../db/schema.js';

/** Persistence-only inventory read model. */
export class InventoryDataRepository {
	constructor(private readonly executor: Executor = db) {}
	async bag(id: string): Promise<typeof usersBag.$inferSelect | null> {
		return (await this.executor.select().from(usersBag).where(eq(usersBag.discordId, id)))[0] ?? null;
	}

	async count(id: string, category: string): Promise<number> {
		const table = categoryTable(category);
		const [row] = await this.executor
			.select({ count: sql<number>`count(*)::int` })
			.from(table)
			.where(eq(table.discordId, id));
		return row?.count ?? 0;
	}

	async searchWeapons(id: string, query: string): Promise<GearSearchRow[]> {
		const [character] = await this.executor
			.select({ weapon: userPresets.equippedWeaponId })
			.from(userCharacter)
			.innerJoin(
				userPresets,
				and(
					eq(userPresets.discordId, userCharacter.discordId),
					eq(userPresets.slot, userCharacter.activePresetSlot),
				),
			)
			.where(eq(userCharacter.discordId, id))
			.limit(1);
		const pattern = `%${query}%`;
		const rows = await this.executor
			.select({
				id: userWeapons.weaponId,
				name: weaponRoster.name,
				tier: weaponRoster.tier,
				plus: userWeapons.enhancement,
			})
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.where(
				and(
					eq(userWeapons.discordId, id),
					or(ilike(weaponRoster.name, pattern), ilike(userWeapons.weaponId, pattern)),
				),
			)
			.orderBy(userWeapons.weaponId)
			.limit(25);
		return rows.map((w) => ({ ...w, plus: enhancementPlus(w.plus), equipped: w.id === character?.weapon }));
	}

	async searchArmors(id: string, query: string): Promise<GearSearchRow[]> {
		const [character] = await this.executor
			.select({ armor: userPresets.equippedArmorId })
			.from(userCharacter)
			.innerJoin(
				userPresets,
				and(
					eq(userPresets.discordId, userCharacter.discordId),
					eq(userPresets.slot, userCharacter.activePresetSlot),
				),
			)
			.where(eq(userCharacter.discordId, id))
			.limit(1);
		const pattern = `%${query}%`;
		const rows = await this.executor
			.select({
				id: userArmors.armorId,
				name: armorRoster.name,
				tier: armorRoster.tier,
				plus: userArmors.enhancement,
			})
			.from(userArmors)
			.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
			.where(
				and(
					eq(userArmors.discordId, id),
					or(ilike(armorRoster.name, pattern), ilike(userArmors.armorId, pattern)),
				),
			)
			.orderBy(userArmors.armorId)
			.limit(25);
		return rows.map((a) => ({ ...a, plus: enhancementPlus(a.plus), equipped: a.id === character?.armor }));
	}

	async searchDeities(id: string, query: string): Promise<DeitySearchRow[]> {
		const pattern = `%${query}%`;
		return this.executor
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
		return (
			this.executor
				.select({
					uid: userRunes.runeUid,
					name: runeRoster.name,
					tier: runeRoster.tier,
					socketedInto: userRunes.socketedInto,
				})
				.from(userRunes)
				.innerJoin(runeRoster, eq(userRunes.runeId, runeRoster.runeId))
				.where(
					and(
						eq(userRunes.discordId, id),
						or(ilike(runeRoster.name, pattern), ilike(userRunes.runeUid, pattern)),
					),
				)
				// Free runes first — that is what /socket equip is looking for.
				.orderBy(sql`${userRunes.socketedInto} is null desc`, userRunes.runeUid)
				.limit(25)
		);
	}
	async weapons(id: string, offset: number) {
		return this.executor
			.select()
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.where(eq(userWeapons.discordId, id))
			.orderBy(userWeapons.weaponId)
			.limit(8)
			.offset(offset);
	}

	async armors(id: string, offset: number) {
		return this.executor
			.select()
			.from(userArmors)
			.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
			.where(eq(userArmors.discordId, id))
			.orderBy(userArmors.armorId)
			.limit(8)
			.offset(offset);
	}

	async runes(id: string, offset: number) {
		return this.executor
			.select()
			.from(userRunes)
			.innerJoin(runeRoster, eq(userRunes.runeId, runeRoster.runeId))
			.where(eq(userRunes.discordId, id))
			.orderBy(userRunes.runeUid)
			.limit(8)
			.offset(offset);
	}

	async deities(id: string, offset: number) {
		return this.executor
			.select()
			.from(userDeities)
			.innerJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
			.where(and(eq(userDeities.discordId, id)))
			.orderBy(userDeities.userDeityId)
			.limit(8)
			.offset(offset);
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

/** Bảng người chơi ứng với từng category kho (mặc định: deity). */
function categoryTable(category: string) {
	switch (category) {
		case 'weapons':
			return userWeapons;
		case 'armors':
			return userArmors;
		case 'runes':
			return userRunes;
		default:
			return userDeities;
	}
}
