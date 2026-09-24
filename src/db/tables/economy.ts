import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const gameLogs = pgTable('game_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	action: text('action').notNull(),
	itemType: text('item_type'),
	previousCredux: integer('previous_credux'),
	updatedCredux: integer('updated_credux'),
	previousBeliefShards: integer('previous_belief_shards'),
	updatedBeliefShards: integer('updated_belief_shards'),
	previousChestCount: integer('previous_chest_count'),
	updatedChestCount: integer('updated_chest_count'),
	previousRelicCount: integer('previous_relic_count'),
	updatedRelicCount: integer('updated_relic_count'),
	previousEssenceCount: integer('previous_essence_count'),
	updatedEssenceCount: integer('updated_essence_count'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// mob_roster ΓÇö original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((mob_type)::text = ANY ((ARRAY['regular'::character varying, 'elite'::character varying, 'boss'::character varying])::text[])))
