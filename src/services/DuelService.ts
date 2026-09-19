import { randomUUID } from 'node:crypto';
import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
	activeDuelParticipants,
	activeDuels,
	pvpLogs,
	users,
	usersBag,
	userCharacter,
	wagerLogs,
} from '../db/schema.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { CosmeticService } from './CosmeticService.js';
import { createCombatant } from '../domain/combat/CombatantState.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { ClassStrategyRegistry } from '../domain/combat/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../domain/combat/RuneStrategyDecorator.js';
import { wrapWithBlessings } from '../domain/combat/DeityBlessingDecorator.js';
import { createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';
import type { AssembledPlayer } from './StatAssemblyService.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';

export const DUEL_STAKE_MIN = 1_000;
export const DUEL_EXPIRES_SECONDS = 60;

export type DuelCreateResult =
	| { status: 'self' }
	| { status: 'invalid-stake' }
	| { status: 'not-registered'; who: 'challenger' | 'opponent' }
	| { status: 'no-character'; who: 'challenger' | 'opponent' }
	| { status: 'busy'; who: 'challenger' | 'opponent' }
	| { status: 'insufficient-funds' }
	| { status: 'ok'; duelId: string; stake: number; expiresAt: Date };

export type DuelAcceptResult =
	| { status: 'not-found' }
	| { status: 'not-opponent' }
	| { status: 'expired' }
	| { status: 'insufficient-funds' }
	| {
			status: 'ok';
			battle: BattleResult;
			challengerId: string;
			opponentId: string;
			challengerName: string;
			opponentName: string;
			winnerId: string | null;
			winnerName: string | null;
			stake: number;
			draw: boolean;
	  };

/**
 * Casual/wager duel (bảng active_duels + active_duel_participants, M7).
 * Challenge → đối thủ Accept/Decline qua nút trên message (60s). Cược bị
 * trừ ở cả hai bên khi accept, winner ăn trọn pot — atomic trong 1 tx
 * (thua rollback = không ai mất tiền). Resolve dùng cùng BattleEngine với
 * StatAssembly + rune + blessing của mỗi người; quest/believer EXP đi qua
 * EventBus sau khi commit.
 */
export class DuelService {
	constructor(
		private readonly accounts = new PlayerAccountRepository(),
		private readonly characters = new UserCharacterRepository(),
		private readonly statAssembly = new StatAssemblyService(),
		private readonly cosmetics = new CosmeticService(),
		private readonly events = EventBus.getInstance(),
	) {}

	async create(challengerId: string, opponentId: string, stake: number): Promise<DuelCreateResult> {
		if (!Number.isSafeInteger(stake) || stake < 0 || (stake > 0 && stake < DUEL_STAKE_MIN))
			return { status: 'invalid-stake' };
		if (challengerId === opponentId) return { status: 'self' };

		return db.transaction(async (tx): Promise<DuelCreateResult> => {
			for (const who of ['challenger', 'opponent'] as const) {
				const id = who === 'challenger' ? challengerId : opponentId;
				const [user] = await tx.select().from(users).where(eq(users.discordId, id)).limit(1);
				if (!user) return { status: 'not-registered', who };
				if (!(await this.characters.hasCharacter(tx, id))) return { status: 'no-character', who };
				const [participant] = await tx
					.select()
					.from(activeDuelParticipants)
					.where(eq(activeDuelParticipants.discordId, id))
					.limit(1);
				if (participant && participant.expiresAt > new Date()) return { status: 'busy', who };
			}

			if (stake > 0) {
				const bags = await tx
					.select({ discordId: usersBag.discordId, credux: usersBag.credux })
					.from(usersBag)
					.where(eq(usersBag.discordId, challengerId));
				const opponentBags = await tx
					.select({ discordId: usersBag.discordId, credux: usersBag.credux })
					.from(usersBag)
					.where(eq(usersBag.discordId, opponentId));
				if (!bags[0] || !opponentBags[0]) return { status: 'not-registered', who: 'challenger' };
				if (bags[0].credux < stake || opponentBags[0].credux < stake) return { status: 'insufficient-funds' };
			}

			const duelId = randomUUID();
			const lockToken = randomUUID();
			const expiresAt = new Date(Date.now() + DUEL_EXPIRES_SECONDS * 1000);
			await tx.insert(activeDuels).values({
				duelId,
				lockToken,
				challengerId,
				opponentId,
				duelType: stake > 0 ? 'wager' : 'casual',
				stake: stake > 0 ? stake : null,
				status: 'pending',
				expiresAt,
			});
			await tx.insert(activeDuelParticipants).values([
				{ discordId: challengerId, duelId, lockToken, role: 'challenger', expiresAt },
				{ discordId: opponentId, duelId, lockToken, role: 'opponent', expiresAt },
			]);
			return { status: 'ok', duelId, stake, expiresAt };
		});
	}

	async accept(duelId: string, acceptorId: string): Promise<DuelAcceptResult> {
		const result = await db.transaction(async (tx): Promise<DuelAcceptResult> => {
			const [duel] = await tx
				.select()
				.from(activeDuels)
				.where(eq(activeDuels.duelId, duelId))
				.limit(1)
				.for('update');
			if (!duel || duel.status !== 'pending') return { status: 'not-found' };
			if (duel.expiresAt <= new Date()) return { status: 'expired' };
			if (acceptorId !== duel.opponentId) return { status: 'not-opponent' };

			const stake = duel.stake ?? 0;
			const challengerId = duel.challengerId;
			const opponentId = duel.opponentId;

			const [challengerBag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, challengerId))
				.limit(1)
				.for('update');
			const [opponentBag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, opponentId))
				.limit(1)
				.for('update');
			if (!challengerBag || !opponentBag) return { status: 'not-found' };
			if (stake > 0 && (challengerBag.credux < stake || opponentBag.credux < stake))
				return { status: 'insufficient-funds' };

			const challengerAccount = await this.accounts.findByIdWithExecutor(tx, challengerId);
			const opponentAccount = await this.accounts.findByIdWithExecutor(tx, opponentId);
			if (!challengerAccount || !opponentAccount) return { status: 'not-found' };
			const chars: Record<string, typeof userCharacter.$inferSelect> = {};
			for (const id of [challengerId, opponentId]) {
				const [character] = await tx
					.select()
					.from(userCharacter)
					.where(eq(userCharacter.discordId, id))
					.limit(1)
					.for('update');
				if (!character) return { status: 'not-found' };
				chars[id] = character;
			}

			if (stake > 0) {
				await tx
					.update(usersBag)
					.set({ credux: challengerBag.credux - stake })
					.where(eq(usersBag.discordId, challengerId));
				await tx
					.update(usersBag)
					.set({ credux: opponentBag.credux - stake })
					.where(eq(usersBag.discordId, opponentId));
			}

			const challengerAssembled = await this.statAssembly.assemble(
				challengerId,
				challengerAccount.combatClass,
				challengerAccount.combatLevel,
				tx,
			);
			const opponentAssembled = await this.statAssembly.assemble(
				opponentId,
				opponentAccount.combatClass,
				opponentAccount.combatLevel,
				tx,
			);

			const challenger = createCombatant({
				name: challengerAccount.username,
				combatClass: challengerAccount.combatClass,
				hp: challengerAssembled.stats.hp,
				atk: challengerAssembled.stats.atk,
				def: challengerAssembled.stats.def,
				crit: challengerAssembled.stats.crit,
			});
			const opponent = createCombatant({
				name: opponentAccount.username,
				combatClass: opponentAccount.combatClass,
				hp: opponentAssembled.stats.hp,
				atk: opponentAssembled.stats.atk,
				def: opponentAssembled.stats.def,
				crit: opponentAssembled.stats.crit,
			});

			const battle = new BattleEngine().resolve(challenger, opponent, createSecureSeed(), {
				playerStrategy: this.buildStrategy(challengerAccount.combatClass, challengerAssembled),
				enemyStrategy: this.buildStrategy(opponentAccount.combatClass, opponentAssembled),
			});

			const draw = battle.outcome === 'draw';
			const challengerWon = battle.outcome === 'player_win';
			const winnerId = draw ? null : challengerWon ? challengerId : opponentId;
			const loserId = draw ? null : challengerWon ? opponentId : challengerId;

			if (draw) {
				// Nobody died-died: refund both stakes (bags were debited at accept).
				if (stake > 0) {
					await tx
						.update(usersBag)
						.set({ credux: challengerBag.credux })
						.where(eq(usersBag.discordId, challengerId));
					await tx
						.update(usersBag)
						.set({ credux: opponentBag.credux })
						.where(eq(usersBag.discordId, opponentId));
				}
			} else if (winnerId && loserId) {
				if (stake > 0) {
					// Bags were debited `stake` each; the winner now takes the whole pot
					// (their own stake back plus the loser's).
					const winnerBag = winnerId === challengerId ? challengerBag : opponentBag;
					await tx
						.update(usersBag)
						.set({ credux: winnerBag.credux + stake })
						.where(eq(usersBag.discordId, winnerId));
				}
				await tx
					.update(userCharacter)
					.set({ pvpWins: chars[winnerId].pvpWins + 1 })
					.where(eq(userCharacter.discordId, winnerId));
				if (chars[winnerId].pvpWins === 0) {
					// First-ever duel win → First Blood title (idempotent grant).
					await this.cosmetics.grantTitleInTx(tx, winnerId, 'first_blood');
				}
				await tx
					.update(userCharacter)
					.set({ pvpLosses: chars[loserId].pvpLosses + 1 })
					.where(eq(userCharacter.discordId, loserId));
				await tx.insert(pvpLogs).values({
					duelId,
					challengerId,
					opponentId,
					winnerId,
					challengerDamage: opponentAssembled.stats.hp - battle.enemyHpRemaining,
					opponentDamage: challengerAssembled.stats.hp - battle.playerHpRemaining,
				});
				if (stake > 0) {
					await tx.insert(wagerLogs).values({ challengerId, opponentId, winnerId, amount: stake });
				}
			}

			await tx.delete(activeDuels).where(eq(activeDuels.duelId, duelId));

			return {
				status: 'ok',
				battle,
				challengerId,
				opponentId,
				challengerName: challengerAccount.username,
				opponentName: opponentAccount.username,
				winnerId,
				winnerName: draw ? null : challengerWon ? challengerAccount.username : opponentAccount.username,
				stake,
				draw,
			};
		});

		if (result.status === 'ok' && !result.draw && result.winnerId) {
			const loserId = result.winnerId === result.challengerId ? result.opponentId : result.challengerId;
			this.events.emit('battle.won', { discordId: result.winnerId, battleType: 'duel' });
			this.events.emit('battle.lost', { discordId: loserId, battleType: 'duel' });
		}
		return result;
	}

	private buildStrategy(combatClass: CombatClass, assembled: AssembledPlayer) {
		return wrapWithBlessings(
			wrapWithRunes(ClassStrategyRegistry.forClass(combatClass), assembled.combatEffectRunes),
			assembled.blessings,
		);
	}

	async decline(duelId: string, userId: string): Promise<boolean> {
		return db.transaction(async (tx) => {
			const [duel] = await tx
				.select()
				.from(activeDuels)
				.where(eq(activeDuels.duelId, duelId))
				.limit(1)
				.for('update');
			if (!duel || duel.status !== 'pending') return false;
			if (userId !== duel.challengerId && userId !== duel.opponentId) return false;
			await tx.delete(activeDuels).where(eq(activeDuels.duelId, duelId));
			return true;
		});
	}

	/** Scheduler sweep — drop expired pending duels (participants cascade). */
	async expireStale(now: Date = new Date()): Promise<number> {
		return db.transaction(async (tx) => {
			const rows = await tx
				.delete(activeDuels)
				.where(and(eq(activeDuels.status, 'pending'), lte(activeDuels.expiresAt, now)))
				.returning({ duelId: activeDuels.duelId });
			return rows.length;
		});
	}
}
