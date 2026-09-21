import { sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';

export interface HealthDatabase {
	execute(query: SQL): PromiseLike<unknown>;
}

export class HealthRepository {
	constructor(private readonly database: HealthDatabase = db) {}

	async checkDatabase(): Promise<void> {
		await this.database.execute(sql`SELECT 1`);
	}
}
