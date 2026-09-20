import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

/**
 * Domain events the game engine emits. Extend this map as new systems
 * are ported (quests, achievements, vote rewards...) instead of calling
 * those systems directly from combat/economy code — that direct-call
 * style is exactly what made the original battleEngine.js a 2500-line
 * file that everything imported from.
 */
export interface DomainEvents {
	'battle.won': { discordId: string; battleType: 'raid' | 'duel' | 'ranked' | 'boss' };
	'battle.lost': { discordId: string; battleType: 'raid' | 'duel' | 'ranked' | 'boss' };
	'currency.earned': { discordId: string; currency: string; amount: number; source: string };
	'level.up': { discordId: string; newLevel: number };
	// --- M7 quest/reputation hooks (subscribers: QuestService, ReputationService) ---
	'summon.done': { discordId: string; count: number };
	'gear.enhanced': { discordId: string; success: boolean };
	'chest.opened': { discordId: string; chest: string; count: number };
	'casino.played': { discordId: string; game: string };
	'daily.claimed': { discordId: string; streak: number };
}

type Listener<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;

/**
 * Observer pattern: a Singleton pub/sub bus. Combat/economy code fires
 * events ("what happened") without knowing who cares ("who reacts").
 * Quest/achievement/vote-reward modules subscribe independently.
 */
export class EventBus {
	private static instance: EventBus | null = null;
	private readonly emitter = new EventEmitter();

	private constructor() {
		this.emitter.setMaxListeners(50);
	}

	static getInstance(): EventBus {
		EventBus.instance ??= new EventBus();
		return EventBus.instance;
	}

	on<K extends keyof DomainEvents>(event: K, listener: Listener<K>): void {
		this.emitter.on(event, listener);
	}

	emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
		// Audit trail: mọi nghiệp vụ phát event đều in ra console để theo dõi.
		logger.info({ event, ...structuredClone(payload) } as unknown as Record<string, unknown>, 'domain-event');
		this.emitter.emit(event, payload);
	}
}
