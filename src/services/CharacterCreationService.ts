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

	createCharacter(discordId: string, combatClass: CombatClass): CreateCharacterResult {
		return db.transaction((tx): CreateCharacterResult => {
			if (!this.users.isRegistered(tx, discordId)) {
				return { status: 'not-registered' };
			}
			if (this.characters.hasCharacter(tx, discordId)) {
				return { status: 'already-has-character' };
			}

			const weaponRosterId = this.gear.findWeaponRosterIdByName(tx, STARTER_WEAPON_NAME);
			const armorRosterId = this.gear.findArmorRosterIdByName(tx, STARTER_ARMOR_NAME);
			if (weaponRosterId == null || armorRosterId == null) {
				// Mirrors create.js: a missing seeded roster row means the DB was
				// never seeded, not a player-facing error to explain in detail.
				return { status: 'starter-gear-missing' };
			}

			const idGen = new GearIdGenerator(tx);

			const weaponId = idGen.generateUniqueGearId();
			this.gear.grantWeapon(tx, {
				discordId,
				weaponId,
				weaponRosterId,
				atk: STARTER_WEAPON.atk,
				crit: STARTER_WEAPON.crit,
			});

			const armorId = idGen.generateUniqueGearId();
			this.gear.grantArmor(tx, {
				discordId,
				armorId,
				armorRosterId,
				hp: STARTER_ARMOR.hp,
				def: STARTER_ARMOR.def,
			});

			this.characters.insert(tx, discordId, combatClass);
			this.presets.createDefaultPresets(tx, discordId, { weaponId, armorId });

			const bag = tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).get()!;
			tx.update(usersBag)
				.set({
					beliefShards: bag.beliefShards + GRANT_BELIEF_SHARDS,
					silverChest: bag.silverChest + GRANT_SILVER_CHESTS,
				})
				.where(eq(usersBag.discordId, discordId))
				.run();

			return { status: 'ok', weaponId, armorId };
		});
	}
}
