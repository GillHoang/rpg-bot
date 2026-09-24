import { pgTable, text, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { users } from './identity.js';

export const menuActionReceipts = pgTable(
	'menu_action_receipts',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		requestId: text('request_id').notNull(),
		kind: text('kind').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.discordId, table.requestId] })],
);

/** Shared business cooldown for valid hunt attempts across every entry point. */
