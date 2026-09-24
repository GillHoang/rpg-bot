import { SCHEDULER_LOG_TEXT } from '../shared/ui/text/diagnostics.js';
import { MaintenanceRepository } from '../modules/system/infrastructure/MaintenanceRepository.js';
import { DuelService } from '../modules/pvp/application/DuelService.js';
import { logger } from '../shared/utils/logger.js';
import { systemClock, type Clock } from '../shared/kernel/clock.js';

const SWEEP_INTERVAL_MS = 30_000;

/**
 * M7 scheduler — chỉ làm sweeps nhẹ: duel pending hết hạn → huỷ + nhả lock,
 * ranked lock treo (tx chưa kịp dọn) → xoá. Reset daily/weekly (reputation
 * cap, quest) theo kiểu lazy: so ngày Việt Nam tại điểm đọc, không cần cron.
 * World boss / vote reward nằm ngoài phạm vi đợt này.
 */
export class Scheduler {
	private timer?: ReturnType<typeof setInterval>;
	private sweeping = false;

	constructor(
		private readonly duels: Pick<DuelService, 'expireStale'>,
		private readonly maintenance: Pick<MaintenanceRepository, 'clearExpiredRankedLocks'>,
		private readonly clock: Clock = systemClock,
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
		// No re-entry: a hung sweep must never stack another one on top of
		// it every 30s (same guard shape as BotMaintenance.recover).
		if (this.sweeping) return;
		this.sweeping = true;
		try {
			const expired = await this.duels.expireStale(this.clock.now());
			if (expired > 0) logger.info({ expired }, SCHEDULER_LOG_TEXT.duelsSwept);
			await this.maintenance.clearExpiredRankedLocks(this.clock.now());
		} catch (error) {
			logger.error({ error }, SCHEDULER_LOG_TEXT.sweepFailed);
		} finally {
			this.sweeping = false;
		}
	}
}
