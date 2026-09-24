import { DATABASE_LOG_TEXT } from '../shared/ui/text/diagnostics.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { logger } from '../shared/utils/logger.js';

await migrate(db, { migrationsFolder: './src/db/migrations' });
logger.info(DATABASE_LOG_TEXT.migrationsApplied);
await pool.end();
