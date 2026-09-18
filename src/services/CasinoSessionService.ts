import { randomUUID } from 'node:crypto';
import { and, eq, lte } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { activeCasinoSessions, usersBag, casinoLogs } from '../db/schema.js';
import { createSecureSeed } from '../domain/combat/Rng.js';
import {
	replayGame,
	type InteractiveGame,
	type CasinoAction,
	type StoredGame,
} from '../domain/casino/InteractiveGame.js';
import { MAX_BET } from '../config/casinoPayouts.js';

export type SessionView =
	| { status: 'ok'; sessionId: string; game: InteractiveGame; done: boolean; text: string; revision: number }
	| { status: 'error'; text: string };
export class CasinoSessionService {
	async start(id: string, game: InteractiveGame, bet: number): Promise<SessionView> {
		if (!Number.isSafeInteger(bet) || bet <= 0 || bet > MAX_BET)
			return { status: 'error', text: `Cược từ 1 đến ${MAX_BET}.` };
		return db.transaction(async (tx) => {
			const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, id)).for('update');
			if (!bag) return { status: 'error', text: 'Dùng /register trước.' };
			const active = await tx
				.select()
				.from(activeCasinoSessions)
				.where(and(eq(activeCasinoSessions.discordId, id), eq(activeCasinoSessions.status, 'active')));
			if (active.length)
				return { status: 'error', text: 'Bạn đang có một ván chơi. Hoàn tất hoặc chờ hết 60 giây.' };
			if (bag.credux < bet) return { status: 'error', text: 'Không đủ Credux.' };
			const sessionId = randomUUID();
			const stored: StoredGame = { seed: createSecureSeed(), actions: [] };
			const [session] = await tx
				.insert(activeCasinoSessions)
				.values({
					sessionId,
					discordId: id,
					game,
					status: 'active',
					betAmount: bet,
					balanceBefore: bag.credux,
					balanceAfterDebit: bag.credux - bet,
					stateJson: stored,
					expiresAt: new Date(Date.now() + 60000),
				})
				.returning();
			await tx
				.update(usersBag)
				.set({ credux: bag.credux - bet })
				.where(eq(usersBag.discordId, id));
			return this.resolve(tx, session, stored);
		});
	}
	async act(id: string, sessionId: string, action: CasinoAction, expectedRevision?: number): Promise<SessionView> {
		return db.transaction(async (tx) => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, id)).for('update');
			const [session] = await tx
				.select()
				.from(activeCasinoSessions)
				.where(and(eq(activeCasinoSessions.sessionId, sessionId), eq(activeCasinoSessions.discordId, id)))
				.for('update');
			if (!session) return { status: 'error', text: 'Không tìm thấy phiên chơi của bạn.' };
			const stored = session.stateJson as StoredGame;
			if (session.status !== 'active')
				return {
					status: 'ok',
					sessionId,
					game: session.game as InteractiveGame,
					done: true,
					revision: stored.actions.length,
					text: `${replayGame(session.game as InteractiveGame, session.betAmount, stored).text}\nVán đã kết thúc. Payout: ${session.payout ?? 0} Credux.`,
				};
			const next = Date.now() >= session.expiresAt.getTime() ? 'timeout' : action;
			if (next !== 'timeout' && expectedRevision !== undefined && expectedRevision !== stored.actions.length)
				return this.resolve(tx, session, stored);
			if (
				next !== 'timeout' &&
				!(session.game === 'blackjack' ? ['hit', 'stand'] : ['push', 'cash']).includes(next)
			)
				return { status: 'error', text: 'Thao tác không hợp lệ.' };
			stored.actions.push(next);
			return this.resolve(tx, session, stored);
		});
	}
	private async resolve(
		tx: Executor,
		s: typeof activeCasinoSessions.$inferSelect,
		stored: StoredGame,
	): Promise<SessionView> {
		const game = s.game as InteractiveGame;
		const view = replayGame(game, s.betAmount, stored);
		if (!view.done) {
			await tx
				.update(activeCasinoSessions)
				.set({ stateJson: stored, updatedAt: new Date() })
				.where(eq(activeCasinoSessions.sessionId, s.sessionId));
			return {
				status: 'ok',
				sessionId: s.sessionId,
				game,
				done: false,
				revision: stored.actions.length,
				text: view.text + '\nTự Stand / Cash Out sau 60 giây tính từ khi mở ván. Tiền cược đã trừ.',
			};
		}
		const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, s.discordId));
		const after = bag.credux + view.payout;
		await tx.update(usersBag).set({ credux: after }).where(eq(usersBag.discordId, s.discordId));
		await tx
			.update(activeCasinoSessions)
			.set({
				stateJson: stored,
				status: 'settled',
				payout: view.payout,
				balanceAfter: after,
				updatedAt: new Date(),
			})
			.where(eq(activeCasinoSessions.sessionId, s.sessionId));
		await tx.insert(casinoLogs).values({
			discordId: s.discordId,
			game,
			betAmount: s.betAmount,
			result: view.result,
			payout: view.payout,
			balanceBefore: s.balanceBefore,
			balanceAfter: after,
			metadata: { sessionId: s.sessionId, actions: stored.actions },
		});
		return {
			status: 'ok',
			sessionId: s.sessionId,
			game,
			done: true,
			revision: stored.actions.length,
			text: `${view.text}\n${view.result} · Nhận ${view.payout.toLocaleString()} · Số dư ${after.toLocaleString()} Credux.`,
		};
	}
	async recoverExpired(): Promise<void> {
		const expired = await db
			.select()
			.from(activeCasinoSessions)
			.where(and(eq(activeCasinoSessions.status, 'active'), lte(activeCasinoSessions.expiresAt, new Date())));
		for (const s of expired) await this.act(s.discordId, s.sessionId, 'timeout');
	}
}
