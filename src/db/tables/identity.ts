import { pgTable, text, integer, bigint, primaryKey, unique, check, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { titleCatalog } from './meta.js';
import { userDeities, userArmors, userWeapons } from './progression.js';

export const users = pgTable('users', {
	discordId: text('discord_id').primaryKey(),
	username: text('username').notNull(),
	monthlyStreak: integer('monthly_streak').notNull().default(0),
	overallStreak: integer('overall_streak').notNull().default(0),
	lastDailyClaimDate: text('last_daily_claim_date'),
	lastBestowReceived: text('last_bestow_received'),
	bestowReceivedToday: integer('bestow_received_today').notNull().default(0),
	lastBossAttackDate: text('last_boss_attack_date'),
	isBanned: boolean('is_banned').notNull().default(false),
	registeredAt: timestamp('registered_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	questRefreshesToday: integer('quest_refreshes_today').notNull().default(0),
	lastQuestRefreshDate: text('last_quest_refresh_date'),
});

// users_bag ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (custom_avatar_token >= 0)
//   CHECK (custom_deity_token >= 0)

export const userCharacter = pgTable(
	'user_character',
	{
		discordId: text('discord_id')
			.primaryKey()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		class: text('class').notNull(),
		combatLevel: integer('combat_level').notNull().default(1),
		combatExp: bigint('combat_exp', { mode: 'number' }).notNull().default(0),
		activePresetSlot: integer('active_preset_slot').notNull().default(1),
		/** Sß╗æ tß║ºng ─æ├ú v╞░ß╗út cß╗ºa Gate 1..5 (0-10 mß╗ùi Gate). */
		gate1TiersCleared: integer('gate1_tiers_cleared').notNull().default(0),
		gate2TiersCleared: integer('gate2_tiers_cleared').notNull().default(0),
		gate3TiersCleared: integer('gate3_tiers_cleared').notNull().default(0),
		gate4TiersCleared: integer('gate4_tiers_cleared').notNull().default(0),
		gate5TiersCleared: integer('gate5_tiers_cleared').notNull().default(0),
		highestRaidStreak: integer('highest_raid_streak').notNull().default(0),
		highestRankStreak: integer('highest_rank_streak').notNull().default(0),
		raidsWon: integer('raids_won').notNull().default(0),
		raidsLost: integer('raids_lost').notNull().default(0),
		duelWins: integer('duel_wins').notNull().default(0),
		duelLosses: integer('duel_losses').notNull().default(0),
		highestDuelStreak: integer('highest_duel_streak').notNull().default(0),
		rankedWins: integer('ranked_wins').notNull().default(0),
		rankedLosses: integer('ranked_losses').notNull().default(0),
		pvpWins: integer('pvp_wins').notNull().default(0),
		pvpLosses: integer('pvp_losses').notNull().default(0),
		believerLevel: integer('believer_level').notNull().default(1),
		believerExp: integer('believer_exp').notNull().default(0),
		reputationExpToday: integer('reputation_exp_today').notNull().default(0),
		reputationExpResetDate: text('reputation_exp_reset_date'),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		pvpRating: integer('pvp_rating').notNull().default(1000),
		bossKills: integer('boss_kills').notNull().default(0),
		equippedTitleId: integer('equipped_title_id').references(() => titleCatalog.titleId, { onDelete: 'set null' }),
		pvpPeak: integer('pvp_peak').notNull().default(1000),
		lastWeeklyClaimWeek: text('last_weekly_claim_week'),
		pvpDemotionShield: boolean('pvp_demotion_shield').notNull().default(true),
		bossTopDamage: integer('boss_top_damage').notNull().default(0),
		lifetimeExp: bigint('lifetime_exp', { mode: 'number' }).notNull().default(0),
	},
	(t) => [
		check('character_valid_class', sql`${t.class} IN ('Swordsman', 'Fighter', 'Mage', 'Knight', 'Archer')`),
		check('character_valid_preset', sql`${t.activePresetSlot} IN (1, 2)`),
		check('character_valid_level', sql`${t.combatLevel} BETWEEN 1 AND 100`),
		check('gate1_tiers_valid', sql`${t.gate1TiersCleared} BETWEEN 0 AND 10`),
		check('gate2_tiers_valid', sql`${t.gate2TiersCleared} BETWEEN 0 AND 10`),
		check('gate3_tiers_valid', sql`${t.gate3TiersCleared} BETWEEN 0 AND 10`),
		check('gate4_tiers_valid', sql`${t.gate4TiersCleared} BETWEEN 0 AND 10`),
		check('gate5_tiers_valid', sql`${t.gate5TiersCleared} BETWEEN 0 AND 10`),
	],
);

// user_cosmetics ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((source)::text = ANY ((ARRAY['base'::character varying, 'shop'::character varying, 'founder'::character varying, 'grant'::character varying])::text[])))

export const usersBag = pgTable(
	'users_bag',
	{
		discordId: text('discord_id')
			.primaryKey()
			.references(() => users.discordId),
		credux: bigint('credux', { mode: 'number' }).notNull().default(0),
		beliefShards: integer('belief_shards').notNull().default(0),
		sacredRelics: integer('sacred_relics').notNull().default(0),
		supremeRelics: integer('supreme_relics').notNull().default(0),
		silverChest: integer('silver_chest').notNull().default(0),
		goldChest: integer('gold_chest').notNull().default(0),
		bossTreasureChest: integer('boss_treasure_chest').notNull().default(0),
		bossGoldenChest: integer('boss_golden_chest').notNull().default(0),
		supremeChest: integer('supreme_chest').notNull().default(0),
		epicEssence: integer('epic_essence').notNull().default(0),
		mythicEssence: integer('mythic_essence').notNull().default(0),
		legendaryEssence: integer('legendary_essence').notNull().default(0),
		supremeEssence: integer('supreme_essence').notNull().default(0),
		lifetimeCreduxEarned: bigint('lifetime_credux_earned', { mode: 'number' }).notNull().default(0),
		lesserRuneBag: integer('lesser_rune_bag').notNull().default(0),
		greaterRuneBag: integer('greater_rune_bag').notNull().default(0),
		divineRuneBag: integer('divine_rune_bag').notNull().default(0),
		valorMedals: integer('valor_medals').notNull().default(0),
		customAvatarToken: integer('custom_avatar_token').notNull().default(0),
		customDeityToken: integer('custom_deity_token').notNull().default(0),
		changeClass: integer('change_class').notNull().default(0),
		diamondChest: integer('diamond_chest').notNull().default(0),
		genesisChest: integer('genesis_chest').notNull().default(0),
	},
	(t) => [
		check('bag_nonnegative_currency', sql`${t.credux} >= 0 AND ${t.beliefShards} >= 0 AND ${t.valorMedals} >= 0`),
	],
);

export const userPresets = pgTable(
	'user_presets',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		slot: integer('slot').notNull(),
		name: text('name'),
		equippedDeity1Id: integer('equipped_deity_1_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedDeity2Id: integer('equipped_deity_2_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedDeity3Id: integer('equipped_deity_3_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedEchoDeityId: integer('equipped_echo_deity_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedArmorId: text('equipped_armor_id').references(() => userArmors.armorId, { onDelete: 'set null' }),
		equippedWeaponId: text('equipped_weapon_id').references(() => userWeapons.weaponId, { onDelete: 'set null' }),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		unique0: unique('user_presets_unique_0').on(table.discordId, table.slot),
		validSlot: check('user_presets_valid_slot', sql`${table.slot} IN (1, 2)`),
	}),
);

export const userGuildActivity = pgTable(
	'user_guild_activity',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		guildId: text('guild_id').notNull(),
		lastActive: timestamp('last_active', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.guildId] }),
	}),
);

// user_presets ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (slot = ANY (ARRAY[1, 2]))
//   CHECK ( equipped_echo_deity_id IS NULL OR equipped_echo_deity_id IS NOT DISTINCT FROM equipped_deity_2_id OR equipped_echo_deity_id IS NOT DISTINCT FROM equipped_deity_3_id )
