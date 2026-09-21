import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { DuelRepository } from '../repositories/DuelRepository.js';
import type { activeDuels, usersBag, userCharacter } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import type { Transaction } from '../db/client.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { StatAssemblyService, type AssembledPlayer } from './StatAssemblyService.js';
import { CosmeticService } from './CosmeticService.js';
import type { CombatantState } from '../domain/combat/CombatantState.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { PlayerCombatantFactory } from './combatantFactory.js';
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

export interface DuelDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		DuelRepository,
		| 'createDuel'
		| 'createParticipants'
		| 'findUser'
		| 'findParticipant'
		| 'findBalance'
		| 'deleteDuel'
		| 'lockDuel'
		| 'lockBag'
		| 'lockCharacter'
		| 'debitStake'
		| 'updateBag'
		| 'updateCharacter'
		| 'insertPvpLog'
		| 'insertWagerLog'
		| 'deleteExpiredDuels'
	>;
	engine?: Pick<BattleEngine, 'resolve'>;
	factory?: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
}

/**
 * Casual/wager duel (bảng active_duels + active_duel_participants, M7).
 * Challenge → đối thủ Accept/Decline qua nút trên message (60s). Cược bị
 * trừ ở cả hai bên khi accept, winner ăn trọn pot — atomic trong 1 tx
 * (thua rollback = không ai mất tiền). Resolve dùng cùng BattleEngine với
 * StatAssembly + rune + blessing của mỗi người; quest/believer EXP đi qua
 * EventBus sau khi commit. Wording nằm ở src/text/duel.ts.
 */

export class DuelService {
	private readonly persistence: PersistenceContext;
	private readonly accounts: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly cosmetics: Pick<CosmeticService, 'grantTitleInTx'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<
		DuelRepository,
		| 'createDuel'
		| 'createParticipants'
		| 'findUser'
		| 'findParticipant'
		| 'findBalance'
		| 'deleteDuel'
		| 'lockDuel'
		| 'lockBag'
		| 'lockCharacter'
		| 'debitStake'
		| 'updateBag'
		| 'updateCharacter'
		| 'insertPvpLog'
		| 'insertWagerLog'
		| 'deleteExpiredDuels'
	>;
	private readonly engine: Pick<BattleEngine, 'resolve'>;
	private readonly factory: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;

	constructor(
		accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>,
		characters?: Pick<UserCharacterRepository, 'hasCharacter'>,
		statAssembly?: Pick<StatAssemblyService, 'assemble'>,
		cosmetics?: Pick<CosmeticService, 'grantTitleInTx'>,
		events?: Pick<EventBus, 'emit'>,
		options: DuelDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.accounts = accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.characters = characters ?? new UserCharacterRepository();
		this.statAssembly =
			statAssembly ?? new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.cosmetics = cosmetics ?? new CosmeticService({ persistence: this.persistence });
		this.events = events ?? EventBus.getInstance();
		this.queries = options.queries ?? new DuelRepository();
		this.engine = options.engine ?? new BattleEngine();
		this.factory = options.factory ?? new PlayerCombatantFactory();
	}

	async create(challengerId: string, opponentId: string, stake: number): Promise<DuelCreateResult> {
		if (!Number.isSafeInteger(stake) || stake < 0 || (stake > 0 && stake < DUEL_STAKE_MIN))
			return { status: 'invalid-stake' };
		if (challengerId === opponentId) return { status: 'self' };

		return this.persistence.unitOfWork.run(async (tx): Promise<DuelCreateResult> => {
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
			await this.queries.createDuel(tx, {
				duelId,
				lockToken,
				challengerId,
				opponentId,
				duelType: stake > 0 ? 'wager' : 'casual',
				stake: stake > 0 ? stake : null,
				status: 'pending',
				expiresAt,
			});
			await this.queries.createParticipants(tx, [
				{ discordId: challengerId, duelId, lockToken, role: 'challenger', expiresAt },
				{ discordId: opponentId, duelId, lockToken, role: 'opponent', expiresAt },
			]);
			return { status: 'ok', duelId, stake, expiresAt };
		});
	}

	private async participantGuard(
		tx: Transaction,
		id: string,
		who: 'challenger' | 'opponent',
	): Promise<DuelCreateResult | null> {
		const [user] = await this.queries.findUser(tx, id);
		if (!user) return { status: 'not-registered', who };
		if (!(await this.characters.hasCharacter(tx, id))) return { status: 'no-character', who };
		const [participant] = await this.queries.findParticipant(tx, id);
		if (participant && participant.expiresAt > new Date()) return { status: 'busy', who };
		return null;
	}

	private async bothCanAfford(tx: Transaction, a: string, b: string, stake: number): Promise<boolean> {
		const creux = async (id: string) => {
			const [bag] = await this.queries.findBalance(tx, id);
			return bag?.creux ?? null;
		};
		const aBalance = await creux(a);
		const bBalance = await creux(b);
		if (aBalance == null || bBalance == null) return false;
		return aBalance >= stake && bBalance >= stake;
	}

	async accept(duelId: string, acceptorId: string): Promise<DuelAcceptResult> {
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<DuelAcceptResult> => {
			const loaded = await this.loadAcceptableDuel(tx, duelId, acceptorId);
			if ('error' in loaded) return loaded.error;
			const duel = loaded.duel;

			const stake = duel.stake ?? 0;
			const bags = await this.lockBags(tx, duel.challengerId, duel.opponentId, stake);
			if ('error' in bags) return bags.error;

			const duelists = await this.buildDuelists(tx, duel.challengerId, duel.opponentId);
			if ('error' in duelists) return duelists.error;

			if (stake > 0) await this.debitBoth(tx, duel.challengerId, duel.opponentId, stake);

			const battle = this.engine.resolve(
				duelists.challenger.combatant,
				duelists.opponent.combatant,
				createSecureSeed(),
				{ playerStrategy: duelists.challenger.strategy, enemyStrategy: duelists.opponent.strategy },
			);

			await this.settle(tx, { duel, bags, duelists, battle });
			// Consume the duel: participants cascade with this delete.
			await this.queries.deleteDuel(tx, duel.duelId);
			return {
				status: 'ok',
				battle,
				challengerId: duel.challengerId,
				opponentId: duel.opponentId,
				challengerName: duelists.challenger.account.username,
				opponentName: duelists.opponent.account.username,
				winnerId: settlementWinnerId(battle, duel.challengerId, duel.opponentId),
				winnerName: drawOrWinner(
					battle,
					duelists.challenger.account.username,
					duelists.opponent.account.username,
				),
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
		tx: Transaction,
		duelId: string,
		acceptorId: string,
	): Promise<{ duel: DuelRow } | { error: DuelAcceptResult }> {
		const [duel] = await this.queries.lockDuel(tx, duelId);
		if (duel?.status !== 'pending') return { error: { status: 'not-found' } };
		if (duel.expiresAt <= new Date()) return { error: { status: 'expired' } };
		if (acceptorId !== duel.opponentId) return { error: { status: 'not-opponent' } };
		return { duel };
	}

	private async lockBags(
		tx: Transaction,
		challengerId: string,
		opponentId: string,
		stake: number,
	): Promise<{ challengerBag: BagRow; opponentBag: BagRow } | { error: DuelAcceptResult }> {
		const [challengerBag] = await this.queries.lockBag(tx, challengerId);
		const [opponentBag] = await this.queries.lockBag(tx, opponentId);
		if (!challengerBag || !opponentBag) return { error: { status: 'not-found' } };
		if (stake > 0 && (challengerBag.credux < stake || opponentBag.credux < stake))
			return { error: { status: 'insufficient-funds' } };
		return { challengerBag, opponentBag };
	}

	private async buildDuelists(
		tx: Transaction,
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

	private async buildDuelist(tx: Transaction, discordId: string) {
		const [character] = await this.queries.lockCharacter(tx, discordId);
		if (!character) return null;
		const account = await this.accounts.findByIdWithExecutor(tx, discordId);
		if (!account) return null;
		const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel, tx);
		const combatant = this.factory.createCombatant(account.username, account.combatClass, assembled);
		const strategy = this.factory.createStrategy(account.combatClass, assembled);
		return { account, assembled, combatant, strategy, character };
	}

	private async debitBoth(tx: Transaction, challengerId: string, opponentId: string, stake: number): Promise<void> {
		await this.queries.debitStake(tx, challengerId, stake);
		await this.queries.debitStake(tx, opponentId, stake);
	}

	private async settle(
		tx: Transaction,
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
			await this.queries.updateBag(tx, winnerId, { credux: winnerBag.credux + stake });
		}
		await this.queries.updateCharacter(tx, winnerId, { pvpWins: winner.character.pvpWins + 1 });
		if (winner.character.pvpWins === 0) {
			// First-ever duel win → First Blood title (idempotent grant).
			await this.cosmetics.grantTitleInTx(tx, winnerId, 'first_blood');
		}
		await this.queries.updateCharacter(tx, loserId, { pvpLosses: loser.character.pvpLosses + 1 });
		await this.queries.insertPvpLog(tx, {
			duelId: duel.duelId,
			challengerId: duel.challengerId,
			opponentId: duel.opponentId,
			winnerId,
			challengerDamage: duelists.opponent.assembled.stats.hp - battle.enemyHpRemaining,
			opponentDamage: duelists.challenger.assembled.stats.hp - battle.playerHpRemaining,
		});
		if (stake > 0) {
			await this.queries.insertWagerLog(tx, {
				challengerId: duel.challengerId,
				opponentId: duel.opponentId,
				winnerId,
				amount: stake,
			});
		}
	}

	/** Nobody died-died: refund both stakes (bags were debited at accept). */
	private async refundWager(
		tx: Transaction,
		duel: DuelRow,
		bags: { challengerBag: BagRow; opponentBag: BagRow },
		stake: number,
	): Promise<void> {
		if (stake <= 0) return;
		await this.queries.updateBag(tx, duel.challengerId, { credux: bags.challengerBag.credux });
		await this.queries.updateBag(tx, duel.opponentId, { credux: bags.opponentBag.credux });
	}

	async decline(duelId: string, userId: string): Promise<boolean> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [duel] = await this.queries.lockDuel(tx, duelId);
			if (duel?.status !== 'pending') return false;
			if (userId !== duel.challengerId && userId !== duel.opponentId) return false;
			await this.queries.deleteDuel(tx, duelId);
			return true;
		});
	}

	/** Scheduler sweep — drop expired pending duels (participants cascade). */
	async expireStale(now: Date = new Date()): Promise<number> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const rows = await this.queries.deleteExpiredDuels(tx, now);
			return rows.length;
		});
	}
}

interface Duelist {
	account: { username: string; combatClass: CombatClass; combatLevel: number };
	assembled: AssembledPlayer;
	combatant: CombatantState;
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
