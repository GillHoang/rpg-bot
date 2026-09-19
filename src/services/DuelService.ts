import { randomUUID } from 'node:crypto';
import { and, eq, lte, sql } from 'drizzle-orm';
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
import { StatAssemblyService, type AssembledPlayer } from './StatAssemblyService.js';
import { CosmeticService } from './CosmeticService.js';
import { createCombatant } from '../domain/combat/CombatantState.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { ClassStrategyRegistry } from '../domain/combat/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../domain/combat/RuneStrategyDecorator.js';
import { wrapWithBlessings } from '../domain/combat/DeityBlessingDecorator.js';
import { createSecureSeed } from '../domain/combat/Rng.js';
import type { IClassStrategy } from '../domain/combat/IClassStrategy.js';
import { EventBus } from '../core/EventBus.js';
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

type DuelRow = typeof activeDuels.$inferSelect;
type BagRow = typeof usersBag.$inferSelect;
type CharacterRow = typeof userCharacter.$inferSelect;

/**
 * Casual/wager duel (bảng active_duels + active_duel_participants, M7).
 * Challenge → đối thủ Accept/Decline qua nút trên message (60s). Cược bị
 * trừ ở cả hai bên khi accept, winner ăn trọn pot — atomic trong 1 tx
 * (thua rollback = không ai mất tiền). Resolve dùng cùng BattleEngine với
 * StatAssembly + rune + blessing của mỗi người; quest/believer EXP đi qua
 * EventBus sau khi commit. Wording nằm ở src/text/duel.ts.
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
				const blocked = await this.participantGuard(tx, id, who);
				if (blocked) return blocked;
			}
			if (stake > 0 && !(await this.bothCanAfford(tx, challengerId, opponentId, stake)))
				return { status: 'insufficient-funds' };

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

	private async participantGuard(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		id: string,
		who: 'challenger' | 'opponent',
	): Promise<DuelCreateResult | null> {
		const [user] = await tx.select().from(users).where(eq(users.discordId, id)).limit(1);
		if (!user) return { status: 'not-registered', who };
		if (!(await this.characters.hasCharacter(tx, id))) return { status: 'no-character', who };
		const [participant] = await tx
			.select()
			.from(activeDuelParticipants)
			.where(eq(activeDuelParticipants.discordId, id))
			.limit(1);
		if (participant && participant.expiresAt > new Date()) return { status: 'busy', who };
		return null;
	}

	private async bothCanAfford(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], a: string, b: string, stake: number): Promise<boolean> {
		const creux = async (id: string) => {
			const [bag] = await tx.select({ creux: usersBag.credux }).from(usersBag).where(eq(usersBag.discordId, id)).limit(1);
			return bag?.creux ?? null;
		};
		const aBalance = await creux(a);
		const bBalance = await creux(b);
		if (aBalance == null || bBalance == null) return false;
		return aBalance >= stake && bBalance >= stake;
	}

	async accept(duelId: string, acceptorId: string): Promise<DuelAcceptResult> {
		const result = await db.transaction(async (tx): Promise<DuelAcceptResult> => {
			const loaded = await this.loadAcceptableDuel(tx, duelId, acceptorId);
			if ('error' in loaded) return loaded.error;
			const duel = loaded.duel;

			const stake = duel.stake ?? 0;
			const bags = await this.lockBags(tx, duel.challengerId, duel.opponentId, stake);
			if ('error' in bags) return bags.error;

			const duelists = await this.buildDuelists(tx, duel.challengerId, duel.opponentId);
			if ('error' in duelists) return duelists.error;

			if (stake > 0) await this.debitBoth(tx, duel.challengerId, duel.opponentId, stake);

			const battle = new BattleEngine().resolve(
				duelists.challenger.combatant,
				duelists.opponent.combatant,
				createSecureSeed(),
				{ playerStrategy: duelists.challenger.strategy, enemyStrategy: duelists.opponent.strategy },
			);

			await this.settle(tx, { duel, bags, duelists, battle });
			// Consume the duel: participants cascade with this delete.
			await tx.delete(activeDuels).where(eq(activeDuels.duelId, duel.duelId));
			return {
				status: 'ok',
				battle,
				challengerId: duel.challengerId,
				opponentId: duel.opponentId,
				challengerName: duelists.challenger.account.username,
				opponentName: duelists.opponent.account.username,
				winnerId: settlementWinnerId(battle, duel.challengerId, duel.opponentId),
				winnerName: drawOrWinner(battle, duelists.challenger.account.username, duelists.opponent.account.username),
				stake,
				draw: battle.outcome === 'draw',
			};
		});

		if (result.status === 'ok' && !result.draw && result.winnerId) {
			const loserId = result.winnerId === result.challengerId ? result.opponentId : result.challengerId;
			this.events.emit('battle.won', { discordId: result.winnerId, battleType: 'duel' });
			this.events.emit('battle.lost', { discordId: loserId, battleType: 'duel' });
		}
		return result;
	}

	private async loadAcceptableDuel(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		duelId: string,
		acceptorId: string,
	): Promise<{ duel: DuelRow } | { error: DuelAcceptResult }> {
		const [duel] = await tx.select().from(activeDuels).where(eq(activeDuels.duelId, duelId)).limit(1).for('update');
		if (duel?.status !== 'pending') return { error: { status: 'not-found' } };
		if (duel.expiresAt <= new Date()) return { error: { status: 'expired' } };
		if (acceptorId !== duel.opponentId) return { error: { status: 'not-opponent' } };
		return { duel };
	}

	private async lockBags(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		challengerId: string,
		opponentId: string,
		stake: number,
	): Promise<{ challengerBag: BagRow; opponentBag: BagRow } | { error: DuelAcceptResult }> {
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
		if (!challengerBag || !opponentBag) return { error: { status: 'not-found' } };
		if (stake > 0 && (challengerBag.credux < stake || opponentBag.credux < stake))
			return { error: { status: 'insufficient-funds' } };
		return { challengerBag, opponentBag };
	}

	private async buildDuelists(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		challengerId: string,
		opponentId: string,
	): Promise<
		| {
				challenger: Duelist;
				opponent: Duelist;
		  }
		| { error: DuelAcceptResult }
	> {
		const challenger = await this.buildDuelist(tx, challengerId);
		const opponent = await this.buildDuelist(tx, opponentId);
		if (!challenger || !opponent) return { error: { status: 'not-found' } };
		return { challenger, opponent };
	}

	private async buildDuelist(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], discordId: string) {
		const [character] = await tx
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1)
			.for('update');
		if (!character) return null;
		const account = await this.accounts.findByIdWithExecutor(tx, discordId);
		if (!account) return null;
		const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel, tx);
		const combatant = createCombatant({
			name: account.username,
			combatClass: account.combatClass,
			hp: assembled.stats.hp,
			atk: assembled.stats.atk,
			def: assembled.stats.def,
			crit: assembled.stats.crit,
		});
		const strategy = wrapWithBlessings(
			wrapWithRunes(ClassStrategyRegistry.forClass(account.combatClass), assembled.combatEffectRunes),
			assembled.blessings,
		);
		return { account, assembled, combatant, strategy, character };
	}

	private async debitBoth(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		challengerId: string,
		opponentId: string,
		stake: number,
	): Promise<void> {
		await tx
			.update(usersBag)
			.set({ credux: sql`${usersBag.credux} - ${stake}` })
			.where(eq(usersBag.discordId, challengerId));
		await tx
			.update(usersBag)
			.set({ credux: sql`${usersBag.credux} - ${stake}` })
			.where(eq(usersBag.discordId, opponentId));
	}

	private async settle(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		input: {
			duel: DuelRow;
			bags: { challengerBag: BagRow; opponentBag: BagRow };
			duelists: { challenger: Duelist; opponent: Duelist };
			battle: BattleResult;
		},
	): Promise<void> {
		const { duel, bags, duelists, battle } = input;
		const stake = duel.stake ?? 0;
		if (battle.outcome === 'draw') {
			await this.refundWager(tx, duel, bags, stake);
			return;
		}

		const challengerWon = battle.outcome === 'player_win';
		const winnerId = challengerWon ? duel.challengerId : duel.opponentId;
		const loserId = challengerWon ? duel.opponentId : duel.challengerId;
		const winner = challengerWon ? duelists.challenger : duelists.opponent;
		const loser = challengerWon ? duelists.opponent : duelists.challenger;
		const winnerBag = challengerWon ? bags.challengerBag : bags.opponentBag;

		if (stake > 0) {
			// Bags were debited `stake` each; the winner now takes the whole pot
			// (their own stake back plus the loser's).
			await tx
				.update(usersBag)
				.set({ credux: winnerBag.credux + stake })
				.where(eq(usersBag.discordId, winnerId));
		}
		await tx
			.update(userCharacter)
			.set({ pvpWins: winner.character.pvpWins + 1 })
			.where(eq(userCharacter.discordId, winnerId));
		if (winner.character.pvpWins === 0) {
			// First-ever duel win → First Blood title (idempotent grant).
			await this.cosmetics.grantTitleInTx(tx, winnerId, 'first_blood');
		}
		await tx
			.update(userCharacter)
			.set({ pvpLosses: loser.character.pvpLosses + 1 })
			.where(eq(userCharacter.discordId, loserId));
		await tx.insert(pvpLogs).values({
			duelId: duel.duelId,
			challengerId: duel.challengerId,
			opponentId: duel.opponentId,
			winnerId,
			challengerDamage: duelists.opponent.assembled.stats.hp - battle.enemyHpRemaining,
			opponentDamage: duelists.challenger.assembled.stats.hp - battle.playerHpRemaining,
		});
		if (stake > 0) {
			await tx.insert(wagerLogs).values({
				challengerId: duel.challengerId,
				opponentId: duel.opponentId,
				winnerId,
				amount: stake,
			});
		}
	}

	/** Nobody died-died: refund both stakes (bags were debited at accept). */
	private async refundWager(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		duel: DuelRow,
		bags: { challengerBag: BagRow; opponentBag: BagRow },
		stake: number,
	): Promise<void> {
		if (stake <= 0) return;
		await tx
			.update(usersBag)
			.set({ credux: bags.challengerBag.credux })
			.where(eq(usersBag.discordId, duel.challengerId));
		await tx
			.update(usersBag)
			.set({ credux: bags.opponentBag.credux })
			.where(eq(usersBag.discordId, duel.opponentId));
	}

	async decline(duelId: string, userId: string): Promise<boolean> {
		return db.transaction(async (tx) => {
			const [duel] = await tx.select().from(activeDuels).where(eq(activeDuels.duelId, duelId)).limit(1).for('update');
			if (duel?.status !== 'pending') return false;
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

interface Duelist {
	account: { username: string; combatClass: CombatClass; combatLevel: number };
	assembled: AssembledPlayer;
	combatant: ReturnType<typeof createCombatant>;
	strategy: IClassStrategy;
	character: CharacterRow;
}

function settlementWinnerId(battle: BattleResult, challengerId: string, opponentId: string): string | null {
	if (battle.outcome === 'draw') return null;
	return battle.outcome === 'player_win' ? challengerId : opponentId;
}

function drawOrWinner(battle: BattleResult, challengerName: string, opponentName: string): string | null {
	if (battle.outcome === 'draw') return null;
	return battle.outcome === 'player_win' ? challengerName : opponentName;
}
