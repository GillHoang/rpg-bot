import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { env } from '../config/env.js';

/**
 * Single shared Postgres pool + drizzle instance.
 * Exposed as a plain module-level singleton: importing this file always
 * yields the same `db` object, so repositories never open their own
 * connections. The pool caps concurrent connections so a burst of slash
 * commands can't exhaust the server.
 */
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const db = drizzle(pool, { schema });

/** Transaction handle supplied by the shared database. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Shape shared by `db` itself and the `tx` handle drizzle passes into
 * `db.transaction(async tx => ...)`. Repository methods take this instead
 * of `typeof db` so the same method works standalone or inside a transaction.
 */
export type Executor = typeof db | Transaction;
