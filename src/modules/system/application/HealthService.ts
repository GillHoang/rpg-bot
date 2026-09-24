import { HealthRepository, type HealthDatabase } from '../infrastructure/HealthRepository.js';

/** Probes persistence without coupling command handlers to SQL or the database client. */
export class HealthService {
	constructor(
		database?: HealthDatabase,
		private readonly probe: Pick<HealthRepository, 'checkDatabase'> = new HealthRepository(database),
	) {}

	async checkDatabase(): Promise<void> {
		await this.probe.checkDatabase();
	}
}
