import {
	pgTable,
	text,
	integer,
	real,
	primaryKey,
	unique,
	check,
	boolean,
	jsonb,
	timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';

export const weaponRoster = pgTable('weapon_roster', {
	weaponRosterId: integer('weapon_roster_id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	type: text('type').notNull(),
	tier: text('tier').notNull(),
	mythology: text('mythology').notNull(),
	passiveKey: text('passive_key').notNull(),
	passiveName: text('passive_name').notNull(),
	passiveDescription: text('passive_description').notNull(),
	lore: text('lore'),
	imageFilename: text('image_filename'),
	isAvailable: boolean('is_available').notNull().default(true),
	/** Phase 3 gear set key (nullable = no set, e.g. starter gear). */
	setKey: text('set_key'),
});

export const armorRoster = pgTable('armor_roster', {
	armorRosterId: integer('armor_roster_id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	type: text('type').notNull(),
	tier: text('tier').notNull(),
	mythology: text('mythology').notNull(),
	passiveKey: text('passive_key').notNull(),
	passiveName: text('passive_name').notNull(),
	passiveDescription: text('passive_description').notNull(),
	lore: text('lore'),
	imageFilename: text('image_filename'),
	isAvailable: boolean('is_available').notNull().default(true),
	/** Phase 3 gear set key (nullable = no set, e.g. starter gear). */
	setKey: text('set_key'),
});

export const deityRoster = pgTable(
	'deity_roster',
	{
		deityId: integer('deity_id').primaryKey().generatedByDefaultAsIdentity(),
		name: text('name').notNull(),
		mythology: text('mythology').notNull(),
		tier: text('tier').notNull(),
		baseHp: integer('base_hp').notNull(),
		baseAtk: integer('base_atk').notNull(),
		baseDef: integer('base_def').notNull(),
		blessingKey: text('blessing_key').notNull(),
		blessingName: text('blessing_name').notNull(),
		blessingDescription: text('blessing_description').notNull(),
		lore: text('lore'),
		imageFilename: text('image_filename'),
		isAvailable: boolean('is_available').notNull().default(true),
		blessingScaling: text('blessing_scaling').notNull(),
	},
	(table) => ({
		unique0: unique('deity_roster_unique_0').on(table.name),
	}),
);

export const runeRoster = pgTable('rune_roster', {
	runeId: integer('rune_id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	lane: text('lane').notNull(),
	effectKey: text('effect_key').notNull(),
	tier: text('tier').notNull(),
	value: real('value').notNull(),
	description: text('description').notNull(),
	isAvailable: boolean('is_available').notNull().default(true),
});

export const userWeapons = pgTable(
	'user_weapons',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		weaponId: text('weapon_id').primaryKey(),
		weaponRosterId: integer('weapon_roster_id')
			.notNull()
			.references(() => weaponRoster.weaponRosterId),
		currAtk: integer('curr_atk').notNull(),
		enhancement: integer('enhancement').notNull().default(1),
		baseAtk: integer('base_atk').notNull(),
		crit: real('crit').notNull(),
		/** OwO-style rolled grade; multiplies stats at assembly time (see weaponQuality.ts). */
		quality: text('quality').notNull().default('Common'),
		/** Deity currently wielding this weapon (one weapon per deity). Only the
		 * pantheon lead's weapon counts in battle — see StatAssemblyService. */
		attachedDeityId: integer('attached_deity_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		bonusDmgPct: real('bonus_dmg_pct'),
		isLocked: boolean('is_locked').notNull().default(false),
		obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		nativeSockets: jsonb('native_sockets').notNull(),
		oppositeSockets: jsonb('opposite_sockets').notNull(),
	},
	(t) => [check('user_weapons_valid_enhancement', sql`${t.enhancement} BETWEEN 1 AND 21`)],
);

export const userArmors = pgTable(
	'user_armors',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		armorId: text('armor_id').primaryKey(),
		armorRosterId: integer('armor_roster_id')
			.notNull()
			.references(() => armorRoster.armorRosterId),
		currHp: integer('curr_hp').notNull(),
		currDef: integer('curr_def').notNull(),
		enhancement: integer('enhancement').notNull().default(1),
		baseHp: integer('base_hp').notNull(),
		baseDef: integer('base_def').notNull(),
		nativeSockets: jsonb('native_sockets').notNull(),
		oppositeSockets: jsonb('opposite_sockets').notNull(),
		isLocked: boolean('is_locked').notNull().default(false),
		obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(t) => [check('user_armors_valid_enhancement', sql`${t.enhancement} BETWEEN 1 AND 21`)],
);
// user_character ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((class)::text = ANY ((ARRAY['Swordsman'::character varying, 'Fighter'::character varying, 'Mage'::character varying, 'Knight'::character varying, 'Archer'::character varying])::text[])))
//   CHECK (((combat_level >= 1) AND (combat_level <= 50)))
//   CHECK (active_preset_slot = ANY (ARRAY[1, 2]))
//   CHECK (highest_raid_streak >= 0)
//   CHECK (highest_rank_streak >= 0)

export const userDeities = pgTable(
	'user_deities',
	{
		userDeityId: integer('user_deity_id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		deityId: integer('deity_id')
			.notNull()
			.references(() => deityRoster.deityId),
		currAtk: integer('curr_atk').notNull(),
		currHp: integer('curr_hp').notNull(),
		currDef: integer('curr_def').notNull(),
		enhancement: integer('enhancement').notNull().default(1),
		obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		lastPullDate: text('last_pull_date').notNull(),
		sigils: integer('sigils').notNull().default(0),
		ascended: boolean('ascended').notNull().default(false),
	},
	(table) => ({
		unique0: unique('user_deities_unique_0').on(table.discordId, table.deityId),
	}),
);

export const userRunes = pgTable('user_runes', {
	runeUid: text('rune_uid').primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId),
	runeId: integer('rune_id')
		.notNull()
		.references(() => runeRoster.runeId),
	socketedInto: text('socketed_into'),
	isLocked: boolean('is_locked').notNull().default(false),
	obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	rolledValue: real('rolled_value'),
});

export const essenceBagDef = pgTable('essence_bag_def', {
	bagKey: text('bag_key').primaryKey(),
	openCommand: text('open_command').notNull(),
	essenceTier: text('essence_tier').notNull(),
	essenceCost: integer('essence_cost').notNull(),
	creduxCost: integer('credux_cost').notNull(),
	runePool: jsonb('rune_pool').notNull(),
});

export const socketUnlockCost = pgTable(
	'socket_unlock_cost',
	{
		tier: text('tier').notNull(),
		slotIndex: integer('slot_index').notNull(),
		essenceTier: text('essence_tier').notNull(),
		essenceCost: integer('essence_cost').notNull(),
		creduxCost: integer('credux_cost').notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.tier, table.slotIndex] }),
	}),
);

export const essenceExchangeSubmissions = pgTable('essence_exchange_submissions', {
	submissionId: text('submission_id').primaryKey(),
	discordId: text('discord_id').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

export const summonRewardGrants = pgTable('summon_reward_grants', {
	rewardKey: text('reward_key').primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	source: text('source').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// supporter_grants ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((action)::text = ANY ((ARRAY['grant'::character varying, 'extend'::character varying, 'revoke'::character varying])::text[])))

export const pityCounters = pgTable('pity_counters', {
	discordId: text('discord_id')
		.primaryKey()
		.references(() => users.discordId),
	pityCount: integer('pity_count').notNull().default(0),
});
