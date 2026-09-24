import { EventBus } from '../shared/kernel/EventBus.js';
import { recordFailure } from '../shared/utils/operationalMetrics.js';

const subscribedBuses = new WeakSet<object>();

/**
 * Canonical event-wiring location. The observers below are audit-only:
 * core progression (quest progress, believer EXP) already commits inside
 * each action's transaction and only marks events progressApplied; these
 * listeners record it when an event arrives WITHOUT that mark (i.e. a
 * code path emitted but forgot to apply progress in-transaction).
 * Idempotent per bus — calling twice on the same bus wires once.
 */
export function subscribeDomainEvents(bus: Pick<EventBus, 'on'>): void {
	if (subscribedBuses.has(bus)) return;
	subscribedBuses.add(bus);
	for (const name of [
		'battle.won',
		'daily.claimed',
		'summon.done',
		'gear.enhanced',
		'chest.opened',
		'casino.played',
	] as const) {
		bus.on(name, (event) => {
			if (!event.progressApplied) recordFailure('missing_atomic_progress');
		});
	}
}
