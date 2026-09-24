import {
	pgTable,
	text,
	integer,
	bigint,
	real,
	primaryKey,
	unique,
	boolean,
	jsonb,
	timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';

export const mobRoster = pgTable(
	'mob_roster',
	{
		mobId: integer('mob_id').primaryKey().generatedByDefaultAsIdentity(),
		name: text('name').notNull(),
		mythology: text('mythology').notNull(),
		mobType: text('mob_type').notNull(),
		baseHp: integer('base_hp').notNull(),
		baseAtk: integer('base_atk').notNull(),
		baseDef: integer('base_def').notNull(),
		baseCrit: real('base_crit').notNull(),
		hpPerLevel: integer('hp_per_level').notNull().default(0),
		atkPerLevel: integer('atk_per_level').notNull().default(0),
		defPerLevel: integer('def_per_level').notNull().default(0),
		skillKey: text('skill_key').notNull(),
		skillName: text('skill_name').notNull(),
		skillDescription: text('skill_description').notNull(),
		immunityTags: jsonb('immunity_tags').notNull(),
		specialFlags: jsonb('special_flags').notNull(),
	},
	(table) => [
		// Business-key upsert target for the seed runner (identity PK can't be used).
		unique('mob_roster_business_key').on(table.name, table.mythology, table.mobType),
	],
);

export const raidLogs = pgTable('raid_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	battleType: text('battle_type').notNull(),
	enemyName: text('enemy_name').notNull(),
	enemyTier: text('enemy_tier').notNull(),
	result: text('result').notNull(),
	expEarned: integer('exp_earned').notNull().default(0),
	updatedExp: bigint('updated_exp', { mode: 'number' }).notNull(),
	beliefShardsDropped: integer('belief_shards_dropped').notNull().default(0),
	updatedBeliefShards: integer('updated_belief_shards').notNull(),
	creduxEarned: integer('credux_earned').notNull().default(0),
	updatedCredux: integer('updated_credux').notNull(),
	chestDropped: text('chest_dropped'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// raid_reward_daily_totals ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((silver_chests >= 0) AND (silver_chests <= 20)))
//   CHECK (((gold_chests >= 0) AND (gold_chests <= 10)))
//   CHECK (((belief_shards >= 0) AND (belief_shards <= 10000)))

export const bossAttackLog = pgTable(
	'boss_attack_log',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		bossSpawnId: text('boss_spawn_id') /* TODO pg type: uuid */
			.notNull(),
		guildId: text('guild_id').notNull(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		mobId: integer('mob_id').notNull(),
		totalDamage: integer('total_damage').notNull().default(0),
		attackedAt: timestamp('attacked_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		lastDailyReset: text('last_daily_reset').notNull(),
	},
	(table) => ({
		unique0: unique('boss_attack_log_unique_0').on(table.bossSpawnId, table.discordId),
	}),
);

// boss_spawn_queue ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'spawning'::character varying, 'spawned'::character varying, 'cancelled'::character varying])::text[])))

export const bossSpawnQueue = pgTable('boss_spawn_queue', {
	queueId: integer('queue_id').primaryKey().generatedByDefaultAsIdentity(),
	guildId: text('guild_id').notNull(),
	bossName: text('boss_name').notNull(),
	requestedBy: text('requested_by').notNull(),
	status: text('status').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	claimStartedAt: timestamp('claim_started_at', { mode: 'date', withTimezone: false }),
	spawnedAt: timestamp('spawned_at', { mode: 'date', withTimezone: false }),
	cancelledAt: timestamp('cancelled_at', { mode: 'date', withTimezone: false }),
	cancelledBy: text('cancelled_by'),
	spawnId: text('spawn_id') /* TODO pg type: uuid */,
});

// boss_state ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'dead'::character varying, 'escaped'::character varying])::text[])))

export const bossState = pgTable('boss_state', {
	guildId: text('guild_id').primaryKey(),
	spawnId: text('spawn_id') /* TODO pg type: uuid */
		.notNull(),
	mobId: integer('mob_id')
		.notNull()
		.references(() => mobRoster.mobId),
	bossLevel: integer('boss_level'),
	maxHp: integer('max_hp').notNull(),
	currentHp: integer('current_hp').notNull(),
	scaledAtk: integer('scaled_atk').notNull(),
	scaledDef: integer('scaled_def').notNull(),
	spawnAt: timestamp('spawn_at', { mode: 'date', withTimezone: false }).notNull(),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
	status: text('status').notNull(),
	spawnSource: text('spawn_source').notNull(),
	lastAttackAt: timestamp('last_attack_at', { mode: 'date', withTimezone: false }),
	passiveState: jsonb('passive_state'),
});

// casino_logs ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((result)::text = ANY ((ARRAY['win'::character varying, 'loss'::character varying])::text[])))

export const huntCooldowns = pgTable('hunt_cooldowns', {
	discordId: text('discord_id')
		.primaryKey()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	readyAt: timestamp('ready_at', { mode: 'date', withTimezone: false }).notNull(),
});

// active_battles ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((battle_type)::text = ANY ((ARRAY['raid'::character varying, 'boss'::character varying])::text[])))

export const raidRewardDailyTotals = pgTable(
	'raid_reward_daily_totals',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		rewardDate: text('reward_date').notNull(),
		silverChests: integer('silver_chests').notNull().default(0),
		goldChests: integer('gold_chests').notNull().default(0),
		beliefShards: integer('belief_shards').notNull().default(0),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.rewardDate] }),
	}),
);

export const raidRewardGrants = pgTable('raid_reward_grants', {
	rewardKey: text('reward_key').primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	reward: jsonb('reward').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// ranked_logs ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((result)::text = ANY ((ARRAY['win'::character varying, 'loss'::character varying, 'draw'::character varying])::text[])))

export const activeBattles = pgTable(
	'active_battles',
	{
		battleId: integer('battle_id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		channelId: text('channel_id').notNull(),
		messageId: text('message_id').notNull(),
		battleType: text('battle_type').notNull(),
		mobId: integer('mob_id')
			.notNull()
			.references(() => mobRoster.mobId),
		enemyLevel: integer('enemy_level'),
		playerHp: integer('player_hp').notNull(),
		playerMaxHp: integer('player_max_hp').notNull(),
		enemyHp: integer('enemy_hp').notNull(),
		enemyMaxHp: integer('enemy_max_hp').notNull(),
		currentTurn: integer('current_turn').notNull().default(1),
		playerGoesFirst: boolean('player_goes_first').notNull(),
		activeDebuffs: jsonb('active_debuffs').notNull(),
		battleLog: jsonb('battle_log').notNull(),
		overchargePct: integer('overcharge_pct').notNull().default(0),
		bleedStacks: jsonb('bleed_stacks').notNull(),
		startedAt: timestamp('started_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		unique0: unique('active_battles_unique_0').on(table.discordId),
	}),
);

// active_casino_sessions ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK ((bet_amount > 0))
//   CHECK (((game)::text = ANY ((ARRAY['blackjack'::character varying, 'crash'::character varying])::text[])))
//   CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolving'::character varying, 'settled'::character varying, 'refunded'::character varying, 'expired'::character varying])::text[])))

export const autoRaids = pgTable('auto_raids', {
	discordId: text('discord_id').primaryKey(),
	startedAt: timestamp('started_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	endsAt: timestamp('ends_at', { mode: 'date', withTimezone: false }).notNull(),
	combatLevel: integer('combat_level').notNull(),
});
