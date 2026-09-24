import { randomBytes } from 'node:crypto';
import type { MenuSection } from '../text/menu.js';
import type { GamePanel, GameplayScreen, MenuBattle } from './MenuGameplay.js';

export type MenuScreen =
	| GameplayScreen
	| { kind: 'home' }
	| { kind: 'section'; section: MenuSection }
	| { kind: 'help' }
	| { kind: 'topic'; index: number }
	| { kind: 'search'; query: string };

export interface MenuSession {
	id: string;
	ownerId: string;
	messageId: string | null;
	revision: number;
	screen: MenuScreen;
	history: MenuScreen[];
	expiresAt: number;
	busy: boolean;
	pendingModal: string | null;
	portalId?: string;
	portalGate?: number;
	/** Gate đang chọn ở màn tier (1-5). */
	gateId?: number;
	gamePanel?: GamePanel;
	battle?: MenuBattle;
	notice?: string;
	avatarUrl?: string;
	playerName?: string;
	/** The original menu opens independent panels instead of replacing itself. */
	launcher?: boolean;
}

type Acquisition =
	| { status: 'ok'; session: MenuSession }
	| {
			status: 'expired' | 'forbidden' | 'invalid' | 'stale' | 'busy';
	  };

export class MenuCapacityError extends Error {}

/** UI snapshots only; all authoritative gameplay state remains in the DB. */
export class MenuSessionStore {
	private readonly sessions = new Map<string, MenuSession>();

	constructor(
		private readonly now: () => number = Date.now,
		private readonly ttlMs = 10 * 60_000,
		private readonly maxSessions = 2000,
		private readonly maxPerUser = 5,
	) {}

	create(ownerId: string): MenuSession {
		this.sweep();
		const owned = [...this.sessions.values()].filter((s) => s.ownerId === ownerId);
		if (owned.length >= this.maxPerUser) {
			const oldestIdle = owned.find((s) => !s.busy && !s.launcher) ?? owned.find((s) => !s.busy);
			if (!oldestIdle) throw new MenuCapacityError();
			this.delete(oldestIdle.id);
		}
		if (this.sessions.size >= this.maxSessions) throw new MenuCapacityError();
		const session: MenuSession = {
			id: randomBytes(12).toString('hex'),
			ownerId,
			messageId: null,
			revision: 0,
			screen: { kind: 'home' },
			history: [],
			expiresAt: this.now() + this.ttlMs,
			busy: true,
			pendingModal: null,
		};
		this.sessions.set(session.id, session);
		return session;
	}

	bind(session: MenuSession, messageId: string): void {
		session.messageId = messageId;
		this.release(session);
	}

	acquire(id: string, ownerId: string, messageId: string | undefined, revision: number): Acquisition {
		const session = this.sessions.get(id);
		if (!session) return { status: 'expired' };
		if (session.ownerId !== ownerId) return { status: 'forbidden' };
		if (!messageId || session.messageId !== messageId) return { status: 'invalid' };
		if (session.busy) return { status: 'busy' };
		if (session.expiresAt <= this.now()) {
			this.delete(id);
			return { status: 'expired' };
		}
		if (session.revision !== revision) return { status: 'stale' };
		session.busy = true;
		return { status: 'ok', session };
	}

	release(session: MenuSession): void {
		session.busy = false;
	}

	touch(session: MenuSession): void {
		session.expiresAt = this.now() + this.ttlMs;
	}

	delete(id: string): void {
		this.sessions.delete(id);
	}

	sweep(): void {
		for (const session of this.sessions.values()) {
			if (!session.busy && session.expiresAt <= this.now()) this.delete(session.id);
		}
	}
}
