import type { Transaction } from '../db/client.js';
import { SeasonRepository } from '../repositories/SeasonRepository.js';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';

/** Explicit administrator rollover; expiry alone does not reset shop quotas or ratings. */
export class SeasonService {
	constructor(
		private readonly persistence: PersistenceContext = defaultPersistence,
		private readonly queries = new SeasonRepository(),
	) {}
	async ensureActive(tx: Transaction, now = new Date()) {
		await this.queries.lock(tx);
		const active = await this.queries.active(tx);
		return active ?? this.create(tx, now);
	}
	private async create(tx: Transaction, now: Date) {
		const count = await this.queries.count(tx);
		const created = await this.queries.create(tx, {
			name: `Season ${count + 1}`,
			startsAt: now,
			endsAt: new Date(now.getTime() + 30 * 86400000),
			isActive: true,
		});
		return created;
	}
	async rollover(expectedSeasonId: number, now = new Date()) {
		return this.persistence.unitOfWork.run(async (tx) => {
			await this.queries.lock(tx);
			const active = await this.queries.active(tx);
			if (!active || active.seasonId !== expectedSeasonId) return { status: 'stale' as const };
			if (now < active.endsAt) return { status: 'not-due' as const };
			await this.queries.close(tx, active.seasonId);
			return { status: 'ok' as const, season: await this.create(tx, now) };
		});
	}
}
