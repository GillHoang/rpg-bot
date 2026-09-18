import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { logger } from '../utils/logger.js';

await migrate(db, { migrationsFolder: './src/db/migrations' });
logger.info('Migrations applied.');
await pool.end();
