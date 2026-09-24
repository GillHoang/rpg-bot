import { LOG_EVENT_TEXT } from '../ui/text/diagnostics.js';
import { recordFailure } from '../utils/operationalMetrics.js';
import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

/** Events describe committed actions. Core progression is applied before commit. */
export interface DomainEvents {
	'battle.won': { discordId: string; battleType: 'raid' | 'duel' | 'ranked' | 'boss'; progressApplied?: boolean };
	'battle.lost': { discordId: string; battleType: 'raid' | 'duel' | 'ranked' | 'boss'; progressApplied?: boolean };
	'currency.earned': { discordId: string; currency: string; amount: number; source: string };
	'level.up': { discordId: string; newLevel: number };
	// Progression-bearing events are marked after their transaction commits.
	'summon.done': { discordId: string; count: number; progressApplied?: boolean };
	'gear.enhanced': { discordId: string; success: boolean; progressApplied?: boolean };
	'chest.opened': { discordId: string; chest: string; count: number; progressApplied?: boolean };
	'casino.played': { discordId: string; game: string; progressApplied?: boolean };
	'daily.claimed': { discordId: string; streak: number; progressApplied?: boolean };
}

type Listener<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;

/**
 * Observer pattern: an application-scoped pub/sub bus. Combat/economy code fires
 * events ("what happened") without knowing who cares ("who reacts").
 * Noncritical observers subscribe independently; core rewards commit in the action transaction. getInstance()
 * retains the default bus for callers outside the composed application.
 */
export class EventBus {
	private static instance: EventBus | null = null;
	private readonly emitter = new EventEmitter();

	constructor() {
		this.emitter.setMaxListeners(50);
	}

	static getInstance(): EventBus {
		EventBus.instance ??= new EventBus();
		return EventBus.instance;
	}

	on<K extends keyof DomainEvents>(event: K, listener: Listener<K>): void {
		this.emitter.on(event, (payload: DomainEvents[K]) => {
			try {
				void Promise.resolve(listener(payload)).catch((error: unknown) => {
					recordFailure('observer');
					logger.error({ error, event }, LOG_EVENT_TEXT.eventObserverFailed);
				});
			} catch (error) {
				recordFailure('observer');
				logger.error({ error, event }, LOG_EVENT_TEXT.eventObserverFailed);
			}
		});
	}

	emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
		// Audit trail: mọi nghiệp vụ phát event đều in ra console để theo dõi.
		logger.info(
			{ event, ...structuredClone(payload) } as unknown as Record<string, unknown>,
			LOG_EVENT_TEXT.domainEvent,
		);
		this.emitter.emit(event, payload);
	}
}
