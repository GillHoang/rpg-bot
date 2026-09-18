import Database, { type RunResult } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import * as schema from './schema.js';
import { env } from '../config/env.js';

/**
 * Single shared SQLite connection + drizzle instance.
 * Exposed as a plain module-level singleton: importing this file always
 * yields the same `db` object, so repositories never open their own
 * connections. `better-sqlite3` is synchronous, which suits turn-based
 * combat resolution (no need to await every stat read mid-battle).
 */
const sqlite = new Database(env.DATABASE_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

/**
 * Shape shared by `db` itself and the `tx` handle drizzle passes into
 * `db.transaction(tx => ...)`. Repository methods take this instead of
 * `typeof db` so the same method works standalone or inside a transaction.
 */
export type Executor =
	typeof db | SQLiteTransaction<'sync', RunResult, typeof schema, ExtractTablesWithRelations<typeof schema>>;
