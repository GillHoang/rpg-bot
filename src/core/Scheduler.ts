import { SCHEDULER_LOG_TEXT } from '../text/diagnostics.js';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository.js';
import { DuelService } from '../services/DuelService.js';
import { logger } from '../utils/logger.js';

const SWEEP_INTERVAL_MS = 30_000;

/**
 * M7 scheduler — chỉ làm sweeps nhẹ: duel pending hết hạn → huỷ + nhả lock,
 * ranked lock treo (tx chưa kịp dọn) → xoá. Reset daily/weekly (reputation
 * cap, quest) theo kiểu lazy: so ngày Việt Nam tại điểm đọc, không cần cron.
 * World boss / vote reward nằm ngoài phạm vi đợt này.
 */
export class Scheduler {
	private timer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly duels: Pick<DuelService, 'expireStale'> = new DuelService(),
		private readonly maintenance: Pick<
			MaintenanceRepository,
			'clearExpiredRankedLocks'
		> = new MaintenanceRepository(),
	) {}

	start(): void {
		this.timer ??= setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
		this.timer.unref();
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	private async sweep(): Promise<void> {
		try {
			const expired = await this.duels.expireStale();
			if (expired > 0) logger.info({ expired }, SCHEDULER_LOG_TEXT.duelsSwept);
			await this.maintenance.clearExpiredRankedLocks(new Date());
		} catch (error) {
			logger.error({ error }, SCHEDULER_LOG_TEXT.sweepFailed);
		}
	}
}
