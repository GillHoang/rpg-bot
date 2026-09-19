import { lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { activeRankedFights } from '../db/schema.js';
import { DuelService } from '../services/DuelService.js';
import { logger } from '../utils/logger.js';

const SWEEP_INTERVAL_MS = 30_000;

/**
 * M7 scheduler — chỉ làm sweeps nhẹ: duel pending hết hạn → huỷ + nhả lock,
 * ranked lock treo (tx chưa kịp dọn) → xoá. Reset daily/weekly (reputation
 * cap, quest) theo kiểu lazy: so ngày Manila tại điểm đọc, không cần cron.
 * World boss / vote reward nằm ngoài phạm vi đợt này.
 */
export class Scheduler {
	private readonly duels = new DuelService();

	start(): void {
		setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS).unref();
	}

	private async sweep(): Promise<void> {
		try {
			const expired = await this.duels.expireStale();
			if (expired > 0) logger.info({ expired }, 'Expired pending duels swept');
			await db.delete(activeRankedFights).where(lte(activeRankedFights.expiresAt, new Date()));
		} catch (error) {
			logger.error({ error }, 'Scheduler sweep failed');
		}
	}
}
