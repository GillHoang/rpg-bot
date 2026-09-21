import { lte } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { activeRankedFights } from '../db/schema.js';

export class MaintenanceRepository {
	constructor(private readonly executor: Executor = db) {}

	async clearExpiredRankedLocks(now: Date): Promise<void> {
		await this.executor.delete(activeRankedFights).where(lte(activeRankedFights.expiresAt, now));
	}
}
