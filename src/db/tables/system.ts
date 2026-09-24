import { pgTable, text, integer, unique, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';

export const serverConfig = pgTable('server_config', {
	guildId: text('guild_id').primaryKey(),
	prefix: text('prefix').notNull(),
	announcementChannelId: text('announcement_channel_id'),
	bossAnnouncementChannelId: text('boss_announcement_channel_id'),
	botChannelId: text('bot_channel_id'),
	configuredAt: timestamp('configured_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// socket_unlock_cost ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((tier)::text = ANY ((ARRAY['Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))

export const devLogs = pgTable('dev_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	devId: text('dev_id').notNull(),
	actionType: text('action_type').notNull(),
	targetDiscordId: text('target_discord_id').notNull(),
	amountOrDetail: text('amount_or_detail'),
	preResetSnapshot: jsonb('pre_reset_snapshot'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// equipped_skins ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((category)::text = ANY ((ARRAY['profile'::character varying, 'battle'::character varying, 'battle_result'::character varying, 'summon'::character varying])::text[])))

export const stripeEvents = pgTable('stripe_events', {
	eventId: text('event_id').primaryKey(),
	type: text('type').notNull(),
	processedAt: timestamp('processed_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// summon_reward_grants ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((source)::text = ANY ((ARRAY['belief_shards'::character varying, 'sacred_relic'::character varying, 'supreme_relic'::character varying])::text[])))

export const supporterGrants = pgTable('supporter_grants', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	action: text('action').notNull(),
	tier: text('tier'),
	months: integer('months'),
	paypalRef: text('paypal_ref'),
	grantedBy: text('granted_by').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// supporter_item_grants ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((item_key)::text = 'custom_deity_token'::text))
//   CHECK (quantity > 0)

export const supporterItemGrants = pgTable(
	'supporter_item_grants',
	{
		grantId: integer('grant_id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		itemKey: text('item_key').notNull(),
		quantity: integer('quantity').notNull().default(1),
		grantReason: text('grant_reason').notNull(),
		grantRef: text('grant_ref').notNull(),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		unique0: unique('supporter_item_grants_unique_0').on(
			table.discordId,
			table.itemKey,
			table.grantReason,
			table.grantRef,
		),
	}),
);

export const supporterTokenLedger = pgTable('supporter_token_ledger', {
	entryId: integer('entry_id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	delta: integer('delta').notNull(),
	reason: text('reason').notNull(),
	ref: text('ref'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// supporters ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((founder_number >= 1) AND (founder_number <= 50)))
//   CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'past_due'::character varying, 'canceled'::character varying, 'expired'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['believer'::character varying, 'chosen_believer'::character varying, 'eternal_believer'::character varying])::text[])))
//   CHECK ((token_balance >= 0))

export const supporters = pgTable(
	'supporters',
	{
		discordId: text('discord_id')
			.primaryKey()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		tier: text('tier').notNull(),
		status: text('status').notNull(),
		currentPeriodEnd: timestamp('current_period_end', { mode: 'date', withTimezone: false }),
		founderNumber: integer('founder_number'),
		founderPurchasedAt: timestamp('founder_purchased_at', { mode: 'date', withTimezone: false }),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
		tokenBalance: integer('token_balance').notNull().default(0),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		active: boolean('active').notNull().default(true),
		foundingSupporter: boolean('founding_supporter').notNull().default(false),
		grantedBy: text('granted_by'),
		subscribedAt: timestamp('subscribed_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }),
	},
	(table) => ({
		unique0: unique('supporters_unique_0').on(table.founderNumber),
	}),
);

// tickets ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (type = ANY (ARRAY['avatar'::text, 'deity'::text]))
//   CHECK (status = ANY (ARRAY['queued'::text, 'in_progress'::text, 'done'::text]))

export const tickets = pgTable('tickets', {
	ticketId: text('ticket_id').primaryKey(),
	type: text('type').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	status: text('status').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	completedAt: timestamp('completed_at', { mode: 'date', withTimezone: false }),
	completedBy: text('completed_by'),
	notes: text('notes'),
});

// title_catalog ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((source)::text = ANY ((ARRAY['believer'::character varying, 'rank_season'::character varying, 'boss_feat'::character varying, 'collection'::character varying, 'event'::character varying])::text[])))

export const topggVoteEvents = pgTable('topgg_vote_events', {
	topggVoteId: text('topgg_vote_id').primaryKey(),
	eventType: text('event_type').notNull(),
	discordId: text('discord_id').notNull(),
	topggUserId: text('topgg_user_id'),
	votedAt: timestamp('voted_at', { mode: 'date', withTimezone: false }).notNull(),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }),
	weight: integer('weight').notNull().default(1),
	dailyCycle: text('daily_cycle').notNull(),
	deliveryTrace: text('delivery_trace'),
	outcome: text('outcome').notNull(),
	streakNumber: integer('streak_number'),
	randomReward: text('random_reward'),
	milestoneReward: text('milestone_reward'),
	rewardedAt: timestamp('rewarded_at', { mode: 'date', withTimezone: false }),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// user_armors ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enhancement >= 1) AND (enhancement <= 11)))
