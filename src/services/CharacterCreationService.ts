import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag } from '../db/schema.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { GearRepository } from '../repositories/GearRepository.js';
import { PresetRepository } from '../repositories/PresetRepository.js';
import { GearIdGenerator } from '../utils/idGenerator.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';
import {
	STARTER_WEAPON_NAME,
	STARTER_WEAPON,
	STARTER_ARMOR_NAME,
	STARTER_ARMOR,
	GRANT_BELIEF_SHARDS,
	GRANT_SILVER_CHESTS,
} from '../config/starter.js';

export type CreateCharacterResult =
	| { status: 'not-registered' }
	| { status: 'already-has-character' }
	| { status: 'starter-gear-missing' }
	| { status: 'ok'; weaponId: string; armorId: string };

/**
 * Facade over the multi-table transaction from commands/rpg/create.js's
 * handleConfirm: guard checks, starter gear grant, character row, default
 * presets, and the one-time creation grant (belief shards + silver chests).
 *
 * NOT ported yet (left for later milestones, see README roadmap):
 *  - class preview canvas card (M2, canvas rendering)
 *  - class battle skin auto-grant/equip via cosmetic_catalog (M7, cosmetics)
 */
export class CharacterCreationService {
	constructor(
		private readonly users = new UserRepository(),
		private readonly characters = new UserCharacterRepository(),
		private readonly gear = new GearRepository(),
		private readonly presets = new PresetRepository(),
	) {}

	async createCharacter(discordId: string, combatClass: CombatClass): Promise<CreateCharacterResult> {
		return db.transaction(async (tx): Promise<CreateCharacterResult> => {
			if (!(await this.users.isRegistered(tx, discordId))) {
				return { status: 'not-registered' };
			}
			if (await this.characters.hasCharacter(tx, discordId)) {
				return { status: 'already-has-character' };
			}

			const weaponRosterId = await this.gear.findWeaponRosterIdByName(tx, STARTER_WEAPON_NAME);
			const armorRosterId = await this.gear.findArmorRosterIdByName(tx, STARTER_ARMOR_NAME);
			if (weaponRosterId == null || armorRosterId == null) {
				// Mirrors create.js: a missing seeded roster row means the DB was
				// never seeded, not a player-facing error to explain in detail.
				return { status: 'starter-gear-missing' };
			}

			const idGen = new GearIdGenerator(tx);

			const weaponId = await idGen.generateUniqueGearId();
			await this.gear.grantWeapon(tx, {
				discordId,
				weaponId,
				weaponRosterId,
				atk: STARTER_WEAPON.atk,
				crit: STARTER_WEAPON.crit,
			});

			const armorId = await idGen.generateUniqueGearId();
			await this.gear.grantArmor(tx, {
				discordId,
				armorId,
				armorRosterId,
				hp: STARTER_ARMOR.hp,
				def: STARTER_ARMOR.def,
			});

			await this.characters.insert(tx, discordId, combatClass);
			await this.presets.createDefaultPresets(tx, discordId, { weaponId, armorId });

			const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
			if (!bag) throw new Error(`createCharacter: no users_bag row for ${discordId}`);
			await tx
				.update(usersBag)
				.set({
					beliefShards: bag.beliefShards + GRANT_BELIEF_SHARDS,
					silverChest: bag.silverChest + GRANT_SILVER_CHESTS,
				})
				.where(eq(usersBag.discordId, discordId));

			return { status: 'ok', weaponId, armorId };
		});
	}
}
