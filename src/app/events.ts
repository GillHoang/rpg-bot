import { EventBus } from '../shared/kernel/EventBus.js';
import { recordFailure } from '../shared/utils/operationalMetrics.js';

/**
 * Canonical event-wiring location. Quest progress + believer EXP observe
 * committed actions; core rewards already applied inside the transaction.
 */
export function subscribeDomainEvents(bus: Pick<EventBus, 'on'>): void {
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
