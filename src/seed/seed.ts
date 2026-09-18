/**
 * Seed runner — nạp dữ liệu seed vào SQLite.
 *
 *   npm run db:seed
 *
 * Chạy SAU `npm run db:migrate`. Mọi string/text dữ liệu nằm ở
 * `src/seed/data/*.ts` — sửa ở đó rồi chạy lại script này.
 *
 * Chế độ upsert theo khóa chính (`onConflictDoUpdate`): seed có thể chạy
 * lại bao nhiêu lần cũng không nhân bản row; row người chơi tạo sau đó
 * (users, user_deities...) KHÔNG BAO GIỜ bị xoá.
 */
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
	deityRoster,
	mobRoster,
	weaponRoster,
	armorRoster,
	runeRoster,
	socketUnlockCost,
	essenceBagDef,
} from '../db/schema.js';
import { DEITY_SEED } from './data/deities.js';
import { MOB_SEED } from './data/mobs.js';
import { WEAPON_SEED } from './data/weapons.js';
import { ARMOR_SEED } from './data/armors.js';
import { RUNE_SEED } from './data/runes.js';
import { SOCKET_UNLOCK_COST_SEED, ESSENCE_BAG_DEF_SEED } from './data/runeEconomy.js';

const counts = db.transaction((tx) => {
	for (const row of DEITY_SEED) {
		tx.insert(deityRoster).values(row).onConflictDoUpdate({ target: deityRoster.deityId, set: row }).run();
	}

	for (const row of MOB_SEED) {
		tx.insert(mobRoster)
			.values({ ...row, immunityTags: row.immunityTags, specialFlags: row.specialFlags })
			.onConflictDoUpdate({
				target: mobRoster.mobId,
				set: { ...row, immunityTags: row.immunityTags, specialFlags: row.specialFlags },
			})
			.run();
	}

	for (const row of WEAPON_SEED) {
		tx.insert(weaponRoster).values(row).onConflictDoUpdate({ target: weaponRoster.weaponRosterId, set: row }).run();
	}

	for (const row of ARMOR_SEED) {
		tx.insert(armorRoster).values(row).onConflictDoUpdate({ target: armorRoster.armorRosterId, set: row }).run();
	}

	RUNE_SEED.forEach((row, i) => {
		const full = { ...row, runeId: i + 1 };
		tx.insert(runeRoster).values(full).onConflictDoUpdate({ target: runeRoster.runeId, set: full }).run();
	});

	for (const row of SOCKET_UNLOCK_COST_SEED) {
		tx.insert(socketUnlockCost)
			.values(row)
			.onConflictDoUpdate({ target: [socketUnlockCost.tier, socketUnlockCost.slotIndex], set: row })
			.run();
	}

	for (const row of ESSENCE_BAG_DEF_SEED) {
		tx.insert(essenceBagDef).values(row).onConflictDoUpdate({ target: essenceBagDef.bagKey, set: row }).run();
	}

	return {
		deities: DEITY_SEED.length,
		mobs: MOB_SEED.length,
		weapons: WEAPON_SEED.length,
		armors: ARMOR_SEED.length,
		runes: RUNE_SEED.length,
		socketUnlockCosts: SOCKET_UNLOCK_COST_SEED.length,
		essenceBags: ESSENCE_BAG_DEF_SEED.length,
	};
});

logger.info(
	counts,
	'Seed complete: deities=%s, mobs=%s, weapons=%s, armors=%s, runes=%s, socketUnlockCosts=%s, essenceBags=%s',
	counts.deities,
	counts.mobs,
	counts.weapons,
	counts.armors,
	counts.runes,
	counts.socketUnlockCosts,
	counts.essenceBags,
);
