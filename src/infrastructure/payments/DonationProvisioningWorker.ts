import type { DonationService } from '../../services/DonationService.js';
import type { KeygateSupporterClient } from './KeygateSupporterClient.js';
import { logger } from '../../utils/logger.js';
import { DONATION_ERROR_TEXT, DONATION_LOG_TEXT } from '../../text/diagnostics.js';

/** Polls durable provisioning jobs; only one poll runs per process at a time. */
export class DonationProvisioningWorker {
	private timer: ReturnType<typeof setTimeout> | null = null;
	private current: Promise<void> | null = null;
	private stopped = true;

	constructor(
		private readonly donations: Pick<DonationService, 'processNextProvisioningJob'>,
		private readonly keygate: KeygateSupporterClient,
		private readonly intervalMs = 15_000,
	) {
		if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) throw new Error(DONATION_ERROR_TEXT.workerInterval);
	}

	start(): void {
		if (!this.stopped) return;
		this.stopped = false;
		this.schedule(0);
	}

	async stop(): Promise<void> {
		this.stopped = true;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		await this.current;
	}

	private schedule(delay: number): void {
		if (this.stopped) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.current = this.poll().finally(() => {
				this.current = null;
				this.schedule(this.intervalMs);
			});
		}, delay);
	}

	private async poll(): Promise<void> {
		try {
			for (;;) {
				if (this.stopped) return;
				const result = await this.donations.processNextProvisioningJob(this.keygate);
				if (result.status === 'empty' || result.status === 'disabled') return;
				if (result.status === 'retry') {
					logger.error(
						{ orderId: result.orderId, jobId: result.jobId, error: result.error },
						DONATION_LOG_TEXT.provisioningDeferred,
					);
					return;
				}
			}
		} catch (error) {
			logger.error({ err: error }, DONATION_LOG_TEXT.workerPollFailed);
		}
	}
}
