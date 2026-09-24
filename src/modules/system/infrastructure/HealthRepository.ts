import { sql, type SQL } from 'drizzle-orm';

export interface HealthDatabase {
	execute(query: SQL): PromiseLike<unknown>;
}

export class HealthRepository {
	constructor(private readonly database: HealthDatabase) {}

	async checkDatabase(): Promise<void> {
		await this.database.execute(sql`SELECT 1`);
	}
}
