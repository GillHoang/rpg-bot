import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';

export const activeCasinoSessions = pgTable('active_casino_sessions', {
	sessionId: text('session_id') /* TODO pg type: uuid */
		.primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	game: text('game').notNull(),
	status: text('status').notNull(),
	betAmount: integer('bet_amount').notNull(),
	balanceBefore: integer('balance_before').notNull(),
	balanceAfterDebit: integer('balance_after_debit').notNull(),
	payout: integer('payout'),
	balanceAfter: integer('balance_after'),
	channelId: text('channel_id'),
	messageId: text('message_id'),
	stateJson: jsonb('state_json').notNull(),
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

// active_duel_participants ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((role)::text = ANY ((ARRAY['challenger'::character varying, 'opponent'::character varying])::text[])))

export const casinoLogs = pgTable('casino_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	game: text('game').notNull(),
	betAmount: integer('bet_amount').notNull(),
	result: text('result').notNull(),
	payout: integer('payout').notNull(),
	balanceBefore: integer('balance_before').notNull(),
	balanceAfter: integer('balance_after').notNull(),
	metadata: jsonb('metadata'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// cosmetic_catalog ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((category)::text = ANY ((ARRAY['profile'::character varying, 'battle'::character varying, 'battle_result'::character varying, 'summon'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['believer'::character varying, 'chosen'::character varying, 'eternal'::character varying])::text[])))
//   CHECK ((token_cost >= 0))
