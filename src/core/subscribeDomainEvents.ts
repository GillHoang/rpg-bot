import { EventBus } from './EventBus.js';
import { recordFailure } from '../utils/operationalMetrics.js';

/** Events observe committed actions. Core quest/EXP writes belong to the action transaction. */
export function subscribeDomainEvents(bus: Pick<EventBus, 'on'> = EventBus.getInstance()): void {
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
