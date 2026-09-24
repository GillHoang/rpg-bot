import { pgTable, text, integer, primaryKey, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';

export const activeDuels = pgTable('active_duels', {
	duelId: text('duel_id') /* TODO pg type: uuid */
		.primaryKey(),
	lockToken: text('lock_token') /* TODO pg type: uuid */
		.notNull(),
	challengerId: text('challenger_id').notNull(),
	opponentId: text('opponent_id').notNull(),
	duelType: text('duel_type').notNull(),
	stake: integer('stake'),
	status: text('status').notNull(),
	guildId: text('guild_id'),
	channelId: text('channel_id'),
	messageId: text('message_id'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	acceptedAt: timestamp('accepted_at', { mode: 'date', withTimezone: false }),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

export const activeDuelParticipants = pgTable('active_duel_participants', {
	discordId: text('discord_id').primaryKey(),
	duelId: text('duel_id') /* TODO pg type: uuid */
		.notNull()
		.references(() => activeDuels.duelId, { onDelete: 'cascade' }),
	lockToken: text('lock_token') /* TODO pg type: uuid */
		.notNull(),
	role: text('role').notNull(),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

// active_duels ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((duel_type)::text = ANY ((ARRAY['casual'::character varying, 'wager'::character varying])::text[])))
//   CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'settling'::character varying])::text[])))

export const activeRankedFights = pgTable('active_ranked_fights', {
	discordId: text('discord_id').primaryKey(),
	lockToken: text('lock_token').notNull(),
	startedAt: timestamp('started_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

// armor_roster ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((tier)::text = ANY ((ARRAY['Common'::character varying, 'Rare'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))
//   CHECK (((type)::text = ANY ((ARRAY['Heavy'::character varying, 'Medium'::character varying, 'Light'::character varying])::text[])))

export const pvpLogs = pgTable('pvp_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	duelId: text('duel_id') /* TODO pg type: uuid */,
	challengerId: text('challenger_id').notNull(),
	opponentId: text('opponent_id').notNull(),
	/** Winner is null for a completed draw. */
	winnerId: text('winner_id'),
	/** Result from the challenger's perspective. */
	outcome: text('outcome').notNull().default('draw'),
	challengerDamage: integer('challenger_damage').notNull(),
	opponentDamage: integer('opponent_damage').notNull(),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

export const rankedLogs = pgTable('ranked_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	playerId: text('player_id')
		.notNull()
		.references(() => users.discordId),
	opponentId: text('opponent_id').notNull(),
	result: text('result').notNull(),
	ratingBefore: integer('rating_before').notNull(),
	ratingAfter: integer('rating_after').notNull(),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: true })
		.notNull()
		.default(sql`now()`),
});

// ranked_reward ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((bracket)::text = ANY ((ARRAY['Mortal'::character varying, 'Champion'::character varying, 'Demigod'::character varying, 'Ascendant'::character varying, 'Divine'::character varying])::text[])))

export const rankedReward = pgTable('ranked_reward', {
	bracket: text('bracket').primaryKey(),
	weeklyCredux: integer('weekly_credux').notNull().default(0),
	weeklyPayload: jsonb('weekly_payload').notNull(),
	seasonEndPayload: jsonb('season_end_payload').notNull(),
	weeklyValor: integer('weekly_valor').notNull().default(0),
	seasonValor: integer('season_valor').notNull().default(0),
});

// rune_roster ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((lane)::text = ANY ((ARRAY['offense'::character varying, 'defense'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['Common'::character varying, 'Rare'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))

export const wagerLogs = pgTable('wager_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	challengerId: text('challenger_id').notNull(),
	opponentId: text('opponent_id').notNull(),
	winnerId: text('winner_id').notNull(),
	amount: integer('amount').notNull(),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// weapon_roster ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((tier)::text = ANY ((ARRAY['Common'::character varying, 'Rare'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))
//   CHECK (((type)::text = ANY ((ARRAY['Sword'::character varying, 'Staff'::character varying, 'Gloves'::character varying, 'Bow'::character varying])::text[])))

export const pvpShopPurchases = pgTable(
	'pvp_shop_purchases',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		seasonId: integer('season_id').notNull(),
		itemKey: text('item_key').notNull(),
		qty: integer('qty').notNull().default(0),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.seasonId, table.itemKey] }),
	}),
);

// raid_logs ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enemy_tier)::text = ANY ((ARRAY['regular'::character varying, 'elite'::character varying, 'boss'::character varying])::text[])))
//   CHECK (((result)::text = ANY ((ARRAY['win'::character varying, 'loss'::character varying, 'draw'::character varying])::text[])))
