import { MAINTENANCE_LOG_TEXT } from '../text/diagnostics.js';
import { CasinoSessionService } from '../services/CasinoSessionService.js';
import { Scheduler } from './Scheduler.js';
import { logger } from '../utils/logger.js';
import { menuRouter } from '../menu/menuRuntime.js';

/** Owns maintenance lifecycle; services keep gameplay and persistence decisions. */
export class BotMaintenance {
	private recoveryTimer?: ReturnType<typeof setInterval>;
	private menuTimer?: ReturnType<typeof setInterval>;
	private recovering = false;

	constructor(
		private readonly sessions: Pick<CasinoSessionService, 'recoverExpired'> = new CasinoSessionService(),
		private readonly scheduler: Pick<Scheduler, 'start' | 'stop'> = new Scheduler(),
		private readonly menu: { sweep(): void } = menuRouter,
	) {}

	start(): void {
		if (this.recoveryTimer) return;
		void this.recover();
		this.recoveryTimer = setInterval(() => void this.recover(), 15_000);
		this.recoveryTimer.unref();
		this.scheduler.start();
		this.menuTimer = setInterval(() => this.menu.sweep(), 60_000);
		this.menuTimer.unref();
	}

	stop(): void {
		if (this.recoveryTimer) clearInterval(this.recoveryTimer);
		if (this.menuTimer) clearInterval(this.menuTimer);
		this.recoveryTimer = undefined;
		this.menuTimer = undefined;
		this.scheduler.stop();
	}

	private async recover(): Promise<void> {
		if (this.recovering) return;
		this.recovering = true;
		try {
			await this.sessions.recoverExpired();
		} catch (error) {
			logger.error({ error }, MAINTENANCE_LOG_TEXT.casinoRecoveryFailed);
		} finally {
			this.recovering = false;
		}
	}
}
