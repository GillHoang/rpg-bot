import type { HealthDatabase } from '../infrastructure/HealthRepository.js';
import { HealthRepository } from '../infrastructure/HealthRepository.js';
import { AppError } from '../../../shared/kernel/Result.js';
import { DI_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';

/** Probes persistence without coupling command handlers to SQL or the database client. */
export class HealthService {
	private readonly probe: Pick<HealthRepository, 'checkDatabase'>;
	constructor(database: HealthDatabase | undefined = undefined, probe?: Pick<HealthRepository, 'checkDatabase'>) {
		if (probe) this.probe = probe;
		else if (database) this.probe = new HealthRepository(database);
		else throw new AppError('DI_MISSING_PERSISTENCE', DI_ERROR_TEXT.healthRequiresDatabase);
	}

	async checkDatabase(): Promise<void> {
		await this.probe.checkDatabase();
	}
}
