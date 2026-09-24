import { LOG_EVENT_TEXT, START_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';

import type { Executor } from '../../../db/client.js';
import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import { defaultPersistence } from '../../../db/defaultPersistence.js';
import { AccountLifecycleRepository } from '../infrastructure/AccountLifecycleRepository.js';
import { logger } from '../../../shared/utils/logger.js';

import { UserRepository } from '../infrastructure/UserRepository.js';
import { UserCharacterRepository } from '../infrastructure/UserCharacterRepository.js';
import { GearRepository } from '../../progression/infrastructure/GearRepository.js';
import { PresetRepository } from '../../progression/infrastructure/PresetRepository.js';
import { GearIdGenerator } from '../../../shared/utils/idGenerator.js';
import { CosmeticService } from '../../meta/application/CosmeticService.js';
import type { CombatClass } from '../domain/PlayerAccount.js';
import {
	STARTER_WEAPON_NAME,
	STARTER_WEAPON,
	STARTER_ARMOR_NAME,
	STARTER_ARMOR,
	GRANT_BELIEF_SHARDS,
	GRANT_SILVER_CHESTS,
} from '../../../shared/config/starter.js';

export type StartResult =
	| { status: 'already-has-character' }
	| { status: 'starter-gear-missing' }
	| { status: 'ok'; weaponId: string; armorId: string };

export interface StartDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<AccountLifecycleRepository, 'lockBag' | 'findBag' | 'updateStarterBalances'>;
	createGearIdGenerator?: (executor: Executor) => Pick<GearIdGenerator, 'generateUniqueGearId'>;
}

/**
 * Onboarding một chạm cho /start: đăng ký tài khoản (users → users_bag →
 * pity_counters) VÀ tạo nhân vật + gear khởi đầu trong CÙNG một giao dịch —
 * thay cho cặp /register + /create cũ. Người chơi không thể kẹt ở trạng thái
 * "đã register nhưng chưa có nhân vật".
 */

export class StartService {
	private readonly persistence: PersistenceContext;
	private readonly users: Pick<UserRepository, 'isRegistered' | 'registerNew'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter' | 'insert'>;
	private readonly gear: Pick<
		GearRepository,
		'findWeaponRosterIdByName' | 'findArmorRosterIdByName' | 'grantWeapon' | 'grantArmor'
	>;
	private readonly presets: Pick<PresetRepository, 'createDefaultPresets'>;
	private readonly cosmetics: Pick<CosmeticService, 'grantBaseInTx'>;
	private readonly queries: NonNullable<StartDependencies['queries']>;
	private readonly createGearIdGenerator: (executor: Executor) => Pick<GearIdGenerator, 'generateUniqueGearId'>;
	constructor(
		users: Pick<UserRepository, 'isRegistered' | 'registerNew'> | undefined = undefined,
		characters: Pick<UserCharacterRepository, 'hasCharacter' | 'insert'> | undefined = undefined,
		gear:
			| Pick<
					GearRepository,
					'findWeaponRosterIdByName' | 'findArmorRosterIdByName' | 'grantWeapon' | 'grantArmor'
			  >
			| undefined = undefined,
		presets: Pick<PresetRepository, 'createDefaultPresets'> | undefined = undefined,
		cosmetics: Pick<CosmeticService, 'grantBaseInTx'> | undefined = undefined,
		options: StartDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.users = users ?? new UserRepository();
		this.characters = characters ?? new UserCharacterRepository();
		this.gear = gear ?? new GearRepository();
		this.presets = presets ?? new PresetRepository();
		this.cosmetics = cosmetics ?? new CosmeticService({ persistence: this.persistence });
		this.queries = options.queries ?? new AccountLifecycleRepository();
		this.createGearIdGenerator = options.createGearIdGenerator ?? ((executor) => new GearIdGenerator(executor));
	}

	async start(discordId: string, username: string, combatClass: CombatClass): Promise<StartResult> {
		return this.persistence.unitOfWork.run(async (tx): Promise<StartResult> => {
			await this.queries.lockBag(tx, discordId);
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

			if (!(await this.users.isRegistered(tx, discordId))) {
				await this.users.registerNew(tx, discordId, username);
			}
			// Registration may have waited for another first-time /start or menu.
			await this.queries.lockBag(tx, discordId);
			if (await this.characters.hasCharacter(tx, discordId)) return { status: 'already-has-character' };
			const idGen = this.createGearIdGenerator(tx);

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

			const [bag] = await this.queries.findBag(tx, discordId);
			if (!bag) throw new Error(START_ERROR_TEXT.missingBag(discordId));
			await this.queries.updateStarterBalances(tx, discordId, {
				beliefShards: bag.beliefShards + GRANT_BELIEF_SHARDS,
				silverChest: bag.silverChest + GRANT_SILVER_CHESTS,
			});

			logger.info({ user: discordId, username, combatClass, weaponId, armorId }, LOG_EVENT_TEXT.onboardingStart);
			return { status: 'ok', weaponId, armorId };
		});
	}
}
