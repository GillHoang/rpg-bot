import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client.js';
import { logger } from '../utils/logger.js';

migrate(db, { migrationsFolder: './src/db/migrations' });
logger.info('Migrations applied.');
