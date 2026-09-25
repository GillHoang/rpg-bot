import { SEASON_NAME } from '../../../shared/ui/text/ranked.js';
import type { Transaction } from '../../../db/client.js';
import { SeasonRepository } from '../infrastructure/SeasonRepository.js';
import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import { systemClock, type Clock } from '../../../shared/kernel/clock.js';

/** Season windows (30 days). Expiry auto-rolls: the next ranked fight or
 * shop purchase closes the stale season and opens a fresh one, so quotas
 * never silently serve an expired season while waiting for manual rollover.
 * Ratings intentionally carry over (no reset, no decay). */
export class SeasonService {
	private readonly clock: Clock;
	constructor(
		private readonly persistence: PersistenceContext,
		private readonly queries = new SeasonRepository(),
		clock: Clock = systemClock,
	) {
		this.clock = clock;
	}
	async ensureActive(tx: Transaction, now: Date | undefined = undefined) {
		const at = now ?? this.clock.now();
		await this.queries.lock(tx);
		const active = await this.queries.active(tx);
		if (!active) return this.create(tx, at);
		if (active.endsAt <= at) {
			await this.queries.close(tx, active.seasonId);
			return this.create(tx, at);
		}
		return active;
	}
	private async create(tx: Transaction, now: Date) {
		const count = await this.queries.count(tx);
		const created = await this.queries.create(tx, {
			name: SEASON_NAME(count + 1),
			startsAt: now,
			endsAt: new Date(now.getTime() + 30 * 86400000),
			isActive: true,
		});
		return created;
	}
	async rollover(expectedSeasonId: number, now: Date | undefined = undefined) {
		const at = now ?? this.clock.now();
		return this.persistence.unitOfWork.run(async (tx) => {
			await this.queries.lock(tx);
			const active = await this.queries.active(tx);
			if (active?.seasonId !== expectedSeasonId) return { status: 'stale' as const };
			if (at < active.endsAt) return { status: 'not-due' as const };
			await this.queries.close(tx, active.seasonId);
			return { status: 'ok' as const, season: await this.create(tx, at) };
		});
	}
}
