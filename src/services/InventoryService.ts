import { enhancementPlus } from '../utils/enhancementDisplay.js';
import type { Executor } from '../db/client.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { InventoryDataRepository } from '../repositories/InventoryDataRepository.js';
export type { GearSearchRow, DeitySearchRow, RuneSearchRow } from '../repositories/InventoryDataRepository.js';
import { computeSigilStats } from '../config/ascension.js';
import {
	ARMOR_LIST_LINE,
	DEITY_LIST_LINE,
	RUNE_LIST_LINE,
	RUNE_NOT_SOCKETED,
	WEAPON_LIST_LINE,
} from '../text/inventory.js';

/** Projects persisted inventory into command-facing values and display text. */
export class InventoryService {
	constructor(
		executor: Executor = defaultPersistence.executor,
		private readonly data: Pick<
			InventoryDataRepository,
			| 'bag'
			| 'count'
			| 'weapons'
			| 'armors'
			| 'runes'
			| 'deities'
			| 'searchWeapons'
			| 'searchArmors'
			| 'searchDeities'
			| 'searchRunes'
		> = new InventoryDataRepository(executor),
	) {}
	bag(id: string) {
		return this.data.bag(id);
	}
	count(id: string, category: string) {
		return this.data.count(id, category);
	}
	searchWeapons(id: string, query: string) {
		return this.data.searchWeapons(id, query);
	}
	searchArmors(id: string, query: string) {
		return this.data.searchArmors(id, query);
	}
	searchDeities(id: string, query: string) {
		return this.data.searchDeities(id, query);
	}
	searchRunes(id: string, query: string) {
		return this.data.searchRunes(id, query);
	}
	async list(id: string, category: string, page: number): Promise<string[]> {
		const offset = (page - 1) * 8;
		if (category === 'weapons')
			return (await this.data.weapons(id, offset)).map(({ user_weapons: w, weapon_roster: r }) =>
				WEAPON_LIST_LINE({
					name: r.name,
					tier: r.tier,
					plus: enhancementPlus(w.enhancement),
					id: w.weaponId,
					atk: w.currAtk,
					crit: w.crit,
					native: JSON.stringify(w.nativeSockets),
					opposite: JSON.stringify(w.oppositeSockets),
				}),
			);
		if (category === 'armors')
			return (await this.data.armors(id, offset)).map(({ user_armors: a, armor_roster: r }) =>
				ARMOR_LIST_LINE({
					name: r.name,
					tier: r.tier,
					plus: enhancementPlus(a.enhancement),
					id: a.armorId,
					hp: a.currHp,
					def: a.currDef,
					native: JSON.stringify(a.nativeSockets),
					opposite: JSON.stringify(a.oppositeSockets),
				}),
			);
		if (category === 'runes')
			return (await this.data.runes(id, offset)).map(({ user_runes: u, rune_roster: r }) =>
				RUNE_LIST_LINE({
					name: r.name,
					tier: r.tier,
					lane: r.lane,
					uid: u.runeUid,
					description: r.description,
					socketedInto: u.socketedInto ?? RUNE_NOT_SOCKETED,
				}),
			);
		return (await this.data.deities(id, offset)).map(({ user_deities: u, deity_roster: r }) => {
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
