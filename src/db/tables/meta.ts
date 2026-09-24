import {
	pgTable,
	text,
	integer,
	primaryKey,
	unique,
	uniqueIndex,
	check,
	boolean,
	timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { deityRoster } from './progression.js';

export const dailyQuests = pgTable(
	'daily_quests',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		questType: text('quest_type').notNull(),
		targetCount: integer('target_count').notNull(),
		currentCount: integer('current_count').notNull().default(0),
		rewardCredux: integer('reward_credux').notNull(),
		rewardBeliefShards: integer('reward_belief_shards').notNull(),
		completed: boolean('completed').notNull().default(false),
		questDate: text('quest_date').notNull(),
	},
	(table) => ({
		unique0: unique('daily_quests_unique_0').on(table.discordId, table.questType, table.questDate),
	}),
);

// deity_roster ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((blessing_scaling)::text = ANY ((ARRAY['scalable'::character varying, 'binary'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['Epic'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))

export const weeklyQuests = pgTable(
	'weekly_quests',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		questType: text('quest_type').notNull(),
		targetCount: integer('target_count').notNull(),
		currentCount: integer('current_count').notNull().default(0),
		rewardCredux: integer('reward_credux').notNull(),
		rewardValor: integer('reward_valor').notNull(),
		completed: boolean('completed').notNull().default(false),
		questWeek: text('quest_week').notNull(),
	},
	(table) => ({
		unique0: unique('weekly_quests_unique_0').on(table.discordId, table.questType, table.questWeek),
	}),
);

export const dailyQuestCompletionRewards = pgTable(
	'daily_quest_completion_rewards',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		questDate: text('quest_date').notNull(),
		sacredRelics: integer('sacred_relics').notNull().default(1),
		claimedAt: timestamp('claimed_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.questDate] }),
	}),
);

export const weeklyGrand = pgTable(
	'weekly_grand',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		questWeek: text('quest_week').notNull(),
		claimed: boolean('claimed').notNull().default(false),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.questWeek] }),
	}),
);

export const seasons = pgTable(
	'seasons',
	{
		seasonId: integer('season_id').primaryKey().generatedByDefaultAsIdentity(),
		name: text('name').notNull(),
		theme: text('theme'),
		startsAt: timestamp('starts_at', { mode: 'date', withTimezone: false }).notNull(),
		endsAt: timestamp('ends_at', { mode: 'date', withTimezone: false }).notNull(),
		featuredDeityId: integer('featured_deity_id').references(() => deityRoster.deityId),
		isActive: boolean('is_active').notNull().default(false),
	},
	(t) => [
		uniqueIndex('seasons_one_active')
			.on(t.isActive)
			.where(sql`${t.isActive} = true`),
		check('seasons_valid_window', sql`${t.endsAt} > ${t.startsAt}`),
	],
);

export const cosmeticCatalog = pgTable(
	'cosmetic_catalog',
	{
		cosmeticId: integer('cosmetic_id').primaryKey().generatedByDefaultAsIdentity(),
		cosmeticKey: text('cosmetic_key').notNull(),
		category: text('category').notNull(),
		tier: text('tier').notNull(),
		displayName: text('display_name').notNull(),
		tokenCost: integer('token_cost').notNull().default(0),
		isBase: boolean('is_base').notNull().default(false),
		hasTopLabel: boolean('has_top_label').notNull().default(false),
		displayFilename: text('display_filename'),
		renderFilename: text('render_filename'),
		victoryFilename: text('victory_filename'),
		defeatedFilename: text('defeated_filename'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		skinCode: text('skin_code'),
	},
	(table) => ({
		unique0: unique('cosmetic_catalog_unique_0').on(table.cosmeticKey),
	}),
);

// daily_quest_completion_rewards ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK ((sacred_relics = 1))

export const titleCatalog = pgTable(
	'title_catalog',
	{
		titleId: integer('title_id').primaryKey().generatedByDefaultAsIdentity(),
		code: text('code').notNull(),
		display: text('display').notNull(),
		source: text('source').notNull(),
		isRepeatable: boolean('is_repeatable').notNull().default(true),
		howTo: text('how_to'),
		imageFilename: text('image_filename'),
	},
	(table) => ({
		unique0: unique('title_catalog_unique_0').on(table.code),
	}),
);

// topgg_vote_events ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK ( (rewarded_at IS NULL AND streak_number IS NULL AND random_reward IS NULL AND milestone_reward IS NULL AND outcome <> 'rewarded') OR (rewarded_at IS NOT NULL AND streak_number IS NOT NULL AND random_reward IS NOT NULL AND outcome = 'rewarded') )

export const userCosmetics = pgTable(
	'user_cosmetics',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		cosmeticId: integer('cosmetic_id')
			.notNull()
			.references(() => cosmeticCatalog.cosmeticId, { onDelete: 'cascade' }),
		source: text('source').notNull(),
		acquiredAt: timestamp('acquired_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.cosmeticId] }),
	}),
);

// user_deities ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enhancement >= 1) AND (enhancement <= 11)))

export const equippedSkins = pgTable(
	'equipped_skins',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		category: text('category').notNull(),
		cosmeticId: integer('cosmetic_id').references(() => cosmeticCatalog.cosmeticId, { onDelete: 'set null' }),
		overridePath: text('override_path'),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.category] }),
	}),
);

export const userTitles = pgTable(
	'user_titles',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		titleId: integer('title_id')
			.notNull()
			.references(() => titleCatalog.titleId),
		earnedAt: timestamp('earned_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.titleId] }),
	}),
);

// user_weapons ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enhancement >= 1) AND (enhancement <= 11)))
