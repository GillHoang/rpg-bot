import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag } from '../db/schema.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { GearRepository } from '../repositories/GearRepository.js';
import { PresetRepository } from '../repositories/PresetRepository.js';
import { GearIdGenerator } from '../utils/idGenerator.js';
import { CosmeticService } from './CosmeticService.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';
import {
	STARTER_WEAPON_NAME,
	STARTER_WEAPON,
	STARTER_ARMOR_NAME,
	STARTER_ARMOR,
	GRANT_BELIEF_SHARDS,
	GRANT_SILVER_CHESTS,
} from '../config/starter.js';

export type StartResult =
	| { status: 'already-has-character' }
	| { status: 'starter-gear-missing' }
	| { status: 'ok'; weaponId: string; armorId: string };

/**
 * Onboarding một chạm cho /start: đăng ký tài khoản (users → users_bag →
 * pity_counters) VÀ tạo nhân vật + gear khởi đầu trong CÙNG một giao dịch —
 * thay cho cặp /register + /create cũ. Người chơi không thể kẹt ở trạng thái
 * "đã register nhưng chưa có nhân vật".
 */
export class StartService {
	constructor(
		private readonly users = new UserRepository(),
		private readonly characters = new UserCharacterRepository(),
		private readonly gear = new GearRepository(),
		private readonly presets = new PresetRepository(),
		private readonly cosmetics = new CosmeticService(),
	) {}

	async start(discordId: string, username: string, combatClass: CombatClass): Promise<StartResult> {
		return db.transaction(async (tx): Promise<StartResult> => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
			if (!(await this.users.isRegistered(tx, discordId))) {
				await this.users.registerNew(tx, discordId, username);
			}
			if (await this.characters.hasCharacter(tx, discordId)) {
				return { status: 'already-has-character' };
			}

			const weaponRosterId = await this.gear.findWeaponRosterIdByName(tx, STARTER_WEAPON_NAME);
			const armorRosterId = await this.gear.findArmorRosterIdByName(tx, STARTER_ARMOR_NAME);
			if (weaponRosterId == null || armorRosterId == null) {
				// A missing seeded roster row means the DB was never seeded, not a
				// player-facing error to explain in detail.
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
			// M7 cosmetics: base skins auto-granted and equipped per category.
			await this.cosmetics.grantBaseInTx(tx, discordId);

			const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
			if (!bag) throw new Error(`start: no users_bag row for ${discordId}`);
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
