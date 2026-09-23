import { SEED_LOG_TEXT } from '../text/diagnostics.js';
/**
 * Seed runner — nạp dữ liệu seed vào PostgreSQL.
 *
 *   npm run db:seed
 *
 * Chạy SAU `npm run db:migrate`. Mọi string/text dữ liệu nằm ở
 * `src/text/catalog/*.ts` — sửa text ở đó rồi chạy lại script này.
 *
 * Chế độ upsert theo khóa chính (`onConflictDoUpdate`): seed có thể chạy
 * lại bao nhiêu lần cũng không nhân bản row; row người chơi tạo sau đó
 * (users, user_deities...) KHÔNG BAO GIỜ bị xoá.
 */
import { db, pool } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
	deityRoster,
	mobRoster,
	weaponRoster,
	armorRoster,
	runeRoster,
	socketUnlockCost,
	essenceBagDef,
	cosmeticCatalog,
	titleCatalog,
	rankedReward,
} from '../db/schema.js';
import { DEITY_SEED } from './data/deities.js';
import { MOB_SEED } from './data/mobs.js';
import { WEAPON_SEED } from './data/weapons.js';
import { ARMOR_SEED } from './data/armors.js';
import { RUNE_SEED } from './data/runes.js';
import { SOCKET_UNLOCK_COST_SEED, ESSENCE_BAG_DEF_SEED } from './data/runeEconomy.js';
import { COSMETIC_SEED } from './data/cosmetics.js';
import { TITLE_SEED } from './data/titles.js';
import { RANKED_REWARD_SEED } from './data/rankedRewards.js';

const counts = await db.transaction(async (tx) => {
	for (const row of DEITY_SEED) {
		await tx.insert(deityRoster).values(row).onConflictDoUpdate({ target: deityRoster.deityId, set: row });
	}

	for (const row of MOB_SEED) {
		// mobId is GENERATED ALWAYS AS IDENTITY in Postgres — strip it from
		// both the insert and the upsert payload (rows are matched by the
		// business keys below; identity values must come from the server).
		const { mobId: _mobId, ...rest } = row;
		await tx
			.insert(mobRoster)
			.values({ ...rest, immunityTags: row.immunityTags, specialFlags: row.specialFlags })
			.onConflictDoUpdate({
				target: [mobRoster.name, mobRoster.mythology, mobRoster.mobType],
				set: { ...rest, immunityTags: row.immunityTags, specialFlags: row.specialFlags },
			});
	}

	for (const row of WEAPON_SEED) {
		await tx.insert(weaponRoster).values(row).onConflictDoUpdate({ target: weaponRoster.weaponRosterId, set: row });
	}

	for (const row of ARMOR_SEED) {
		await tx.insert(armorRoster).values(row).onConflictDoUpdate({ target: armorRoster.armorRosterId, set: row });
	}

	for (const [i, row] of RUNE_SEED.entries()) {
		const full = { ...row, runeId: i + 1 };
		await tx.insert(runeRoster).values(full).onConflictDoUpdate({ target: runeRoster.runeId, set: full });
	}

	for (const row of SOCKET_UNLOCK_COST_SEED) {
		await tx
			.insert(socketUnlockCost)
			.values(row)
			.onConflictDoUpdate({ target: [socketUnlockCost.tier, socketUnlockCost.slotIndex], set: row });
	}

	for (const row of ESSENCE_BAG_DEF_SEED) {
		await tx.insert(essenceBagDef).values(row).onConflictDoUpdate({ target: essenceBagDef.bagKey, set: row });
	}

	for (const row of COSMETIC_SEED) {
		await tx
			.insert(cosmeticCatalog)
			.values({ ...row, isActive: true })
			.onConflictDoUpdate({ target: cosmeticCatalog.cosmeticKey, set: { ...row, isActive: true } });
	}

	for (const row of TITLE_SEED) {
		await tx.insert(titleCatalog).values(row).onConflictDoUpdate({ target: titleCatalog.code, set: row });
	}

	for (const row of RANKED_REWARD_SEED) {
		await tx.insert(rankedReward).values(row).onConflictDoUpdate({ target: rankedReward.bracket, set: row });
	}

	return {
		deities: DEITY_SEED.length,
		mobs: MOB_SEED.length,
		weapons: WEAPON_SEED.length,
		armors: ARMOR_SEED.length,
		runes: RUNE_SEED.length,
		socketUnlockCosts: SOCKET_UNLOCK_COST_SEED.length,
		essenceBags: ESSENCE_BAG_DEF_SEED.length,
		cosmetics: COSMETIC_SEED.length,
		titles: TITLE_SEED.length,
		rankedRewards: RANKED_REWARD_SEED.length,
	};
});

logger.info(
	counts,
	SEED_LOG_TEXT.complete,
	counts.deities,
	counts.mobs,
	counts.weapons,
	counts.armors,
	counts.runes,
	counts.socketUnlockCosts,
	counts.essenceBags,
	counts.cosmetics,
	counts.titles,
	counts.rankedRewards,
);

await pool.end();
