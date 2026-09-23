import { comparePlayerIds } from '../utils/comparePlayerIds.js';
import { SeasonService } from './SeasonService.js';
import { GameplayProgressCoordinator } from './gameplayProgress.js';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { RankedRepository } from '../repositories/RankedRepository.js';
import type { userCharacter } from '../db/schema.js';
import type { Transaction } from '../db/client.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { CosmeticService } from './CosmeticService.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { PlayerCombatantFactory } from './combatantFactory.js';
import { createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';
import { BRACKETS, RANKED, bracketFor, eloDelta, weekWindowAt, type Bracket } from '../config/ranked.js';
import {
	RANKED_NOT_REGISTERED,
	RANKED_SHIELD_OFF,
	RANKED_SHIELD_ON,
	RANKED_STATS_BODY,
	RANKED_STATS_HEADER,
	RANKED_WEEK_STATUS,
} from '../text/ranked.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';

const accountCombatClass = (value: string): CombatClass => value as CombatClass;

export type RankedFightResult =
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'busy' }
	| { status: 'no-opponent' }
	| {
			status: 'ok';
			battle: BattleResult;
			opponentId: string;
			opponentName: string;
			won: boolean;
			draw: boolean;
			ratingBefore: number;
			ratingAfter: number;
			bracketBefore: Bracket['name'];
			bracketAfter: Bracket['name'];
			peak: number;
			shieldUsed: boolean;
			delta: number;
	  };

export type RankedClaimResult =
	| { status: 'not-registered' }
	| { status: 'no-fights' }
	| { status: 'already-claimed' }
	| { status: 'no-reward-row' }
	| {
			status: 'ok';
			bracket: Bracket['name'];
			credux: number;
			valor: number;
			chests: string[];
	  };

export interface RankedDependencies {
	progress?: Pick<GameplayProgressCoordinator, 'apply'>;
	persistence?: PersistenceContext;
	queries?: Pick<
		RankedRepository,
		| 'findUser'
		| 'lockCharacter'
		| 'lockBag'
		| 'createFightLock'
		| 'deleteFightLock'
		| 'findWeeklyFight'
		| 'findWeeklyReward'
		| 'updateBag'
		| 'updateCharacter'
		| 'findCharacter'
		| 'insertLog'
		| 'findOpponentInWindow'
		| 'findRecentResults'
	>;
	engine?: Pick<BattleEngine, 'resolve'>;
	factory?: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
}

/**
 * Ranked PvP — async mirror match (M7): loadout hiện tại của một người chơi
 * ngẫu nhiên (rating chênh trong cửa sổ matchmaking) làm đối thủ; không cần
 * cả hai online. Elo K=32 zero-sum, bracket theo rating, demotion shield giữ
 * bracket lần rớt đầu tiên. Thưởng tuần claim theo bảng ranked_reward, điều
 * kiện ≥1 trận trong tuần ISO (Manila).
 */

export class RankedService {
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly seasons = new SeasonService();
	private readonly persistence: PersistenceContext;
	private readonly accounts: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly cosmetics: Pick<CosmeticService, 'grantTitleInTx'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<
		RankedRepository,
		| 'findUser'
		| 'lockCharacter'
		| 'lockBag'
		| 'createFightLock'
		| 'deleteFightLock'
		| 'findWeeklyFight'
		| 'findWeeklyReward'
		| 'updateBag'
		| 'updateCharacter'
		| 'findCharacter'
		| 'insertLog'
		| 'findOpponentInWindow'
		| 'findRecentResults'
	>;
	private readonly engine: Pick<BattleEngine, 'resolve'>;
	private readonly factory: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;

	constructor(
		accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>,
		statAssembly?: Pick<StatAssemblyService, 'assemble'>,
		cosmetics?: Pick<CosmeticService, 'grantTitleInTx'>,
		events?: Pick<EventBus, 'emit'>,
		options: RankedDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.accounts = accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.statAssembly =
			statAssembly ?? new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.cosmetics = cosmetics ?? new CosmeticService({ persistence: this.persistence });
		this.events = events ?? EventBus.getInstance();
		this.queries = options.queries ?? new RankedRepository();
		this.engine = options.engine ?? new BattleEngine();
		this.factory = options.factory ?? new PlayerCombatantFactory();
	}

	async fight(discordId: string): Promise<RankedFightResult> {
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<RankedFightResult> => {
			const [account] = await this.queries.findUser(tx, discordId);
			if (!account) return { status: 'not-registered' };
			const [candidate] = await this.queries.findCharacter(tx, discordId);
			if (!candidate) return { status: 'no-character' };
			const selected = await this.pickOpponentRow(tx, discordId, candidate.pvpRating);
			if (!selected) return { status: 'no-opponent' };
			const locked = await this.lockFighters(tx, discordId, selected.discordId);
			const me = locked.get(discordId);
			const opponentRow = locked.get(selected.discordId);
			if (!me) return { status: 'no-character' };
			if (!opponentRow) return { status: 'no-opponent' };
			const opponentAccount = await this.accounts.findByIdWithExecutor(tx, opponentRow.discordId);
			if (!opponentAccount) return { status: 'no-opponent' };

			const [lock] = await this.queries.createFightLock(tx, {
				discordId,
				lockToken: crypto.randomUUID(),
				expiresAt: new Date(Date.now() + RANKED.LOCK_SECONDS * 1000),
			});
			if (!lock) return { status: 'busy' };

			const myAssembled = await this.statAssembly.assemble(
				discordId,
				accountCombatClass(me.class),
				me.combatLevel,
				tx,
			);
			const opponentAssembled = await this.statAssembly.assemble(
				opponentRow.discordId,
				opponentAccount.combatClass,
				opponentAccount.combatLevel,
				tx,
			);

			const battle = this.engine.resolve(
				this.factory.createCombatant(account.username, accountCombatClass(me.class), myAssembled),
				this.factory.createCombatant(opponentAccount.username, opponentAccount.combatClass, opponentAssembled),
				createSecureSeed(),
				{
					playerStrategy: this.factory.createStrategy(accountCombatClass(me.class), myAssembled),
					enemyStrategy: this.factory.createStrategy(opponentAccount.combatClass, opponentAssembled),
				},
			);

			const won = battle.outcome === 'player_win';
			const draw = battle.outcome === 'draw';
			let score: 0 | 0.5 | 1 = 0;
			if (won) score = 1;
			else if (draw) score = 0.5;

			const ratingBefore = me.pvpRating;
			const meChange = this.resolveRatingChange(
				ratingBefore,
				Math.max(0, ratingBefore + eloDelta(ratingBefore, opponentRow.pvpRating, score)),
				me.pvpDemotionShield,
			);
			const opponentChange = this.resolveRatingChange(
				opponentRow.pvpRating,
				Math.max(
					0,
					opponentRow.pvpRating + eloDelta(opponentRow.pvpRating, ratingBefore, (1 - score) as 0 | 0.5 | 1),
				),
				opponentRow.pvpDemotionShield,
			);
			const ratingAfter = meChange.rating;
			const opponentRatingAfter = opponentChange.rating;

			await this.persistRankedOutcome(tx, {
				discordId,
				me,
				opponentRow,
				opponentRatingAfter,
				ratingBefore,
				ratingAfter,
				won,
				draw,
				meChange,
				opponentChange,
			});

			if (!draw) await this.progress.apply(tx, won ? discordId : opponentRow.discordId, 'ranked', new Date());
			await this.seasons.ensureActive(tx);
			await this.queries.deleteFightLock(tx, discordId);

			return {
				status: 'ok',
				battle,
				opponentId: opponentRow.discordId,
				opponentName: opponentAccount.username,
				won,
				draw,
				ratingBefore,
				ratingAfter,
				bracketBefore: bracketFor(ratingBefore).name,
				bracketAfter: bracketFor(ratingAfter).name,
				peak: Math.max(me.pvpPeak, ratingAfter),
				shieldUsed: meChange.shieldUsed,
				delta: ratingAfter - ratingBefore,
			};
		});

		if (result.status === 'ok' && !result.draw) {
			// A draw must not feed the win/loss quest + reputation subscribers.
			this.events.emit(result.won ? 'battle.won' : 'battle.lost', {
				discordId,
				battleType: 'ranked',
				progressApplied: true,
			});
			this.events.emit(result.won ? 'battle.lost' : 'battle.won', {
				discordId: result.opponentId,
				battleType: 'ranked',
				progressApplied: true,
			});
		}
		return result;
	}

	/** Lock all bags before either character, in the shared player order. */
	private async lockFighters(tx: Transaction, discordId: string, opponentId: string) {
		const ids = [discordId, opponentId].sort(comparePlayerIds);
		for (const id of ids) await this.queries.lockBag(tx, id);
		const locked = new Map<string, typeof userCharacter.$inferSelect>();
		for (const id of ids) {
			const [row] = await this.queries.lockCharacter(tx, id);
			if (row) locked.set(id, row);
		}
		return locked;
	}

	async claim(discordId: string): Promise<RankedClaimResult> {
		return this.persistence.unitOfWork.run(async (tx): Promise<RankedClaimResult> => {
			const [bag] = await this.queries.lockBag(tx, discordId);
			if (!bag) return { status: 'not-registered' };
			const [me] = await this.queries.lockCharacter(tx, discordId);
			if (!me) return { status: 'not-registered' };
			const { key: week, startsAt } = weekWindowAt();
			if (me.lastWeeklyClaimWeek === week) return { status: 'already-claimed' };

			const [fight] = await this.queries.findWeeklyFight(tx, discordId, startsAt);
			if (!fight) return { status: 'no-fights' };

			const bracket = bracketFor(me.pvpRating);
			const [reward] = await this.queries.findWeeklyReward(tx, bracket.name);
			if (!reward) return { status: 'no-reward-row' };

			const payload = reward.weeklyPayload as {
				silverChest?: number;
				goldChest?: number;
				diamondChest?: number;
				genesisChest?: number;
			};
			const chests: string[] = [];
			const patch = {
				credux: bag.credux + reward.weeklyCredux,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + reward.weeklyCredux,
				valorMedals: bag.valorMedals + reward.weeklyValor,
				silverChest: bag.silverChest + (payload.silverChest ?? 0),
				goldChest: bag.goldChest + (payload.goldChest ?? 0),
				diamondChest: bag.diamondChest + (payload.diamondChest ?? 0),
				genesisChest: bag.genesisChest + (payload.genesisChest ?? 0),
			};
			if (payload.silverChest) chests.push(`+${payload.silverChest} Silver`);
			if (payload.goldChest) chests.push(`+${payload.goldChest} Gold`);
			if (payload.diamondChest) chests.push(`+${payload.diamondChest} Diamond`);
			if (payload.genesisChest) chests.push(`+${payload.genesisChest} Genesis`);
			await this.queries.updateBag(tx, discordId, patch);
			await this.queries.updateCharacter(tx, discordId, { lastWeeklyClaimWeek: week });

			return {
				status: 'ok',
				bracket: bracket.name,
				credux: reward.weeklyCredux,
				valor: reward.weeklyValor,
				chests,
			};
		});
	}

	async stats(discordId: string): Promise<string> {
		const [me] = await this.queries.findCharacter(this.persistence.executor, discordId);
		if (!me) return RANKED_NOT_REGISTERED;
		const bracket = bracketFor(me.pvpRating);
		const { week, key, endsAt } = weekWindowAt();
		const claimed = me.lastWeeklyClaimWeek === key;
		return (
			RANKED_STATS_HEADER(me.pvpRating, bracket.name, me.pvpPeak) +
			'\n' +
			RANKED_STATS_BODY(
				me.pvpWins,
				me.pvpLosses,
				me.highestRankStreak,
				me.pvpDemotionShield ? RANKED_SHIELD_ON : RANKED_SHIELD_OFF,
			) +
			'\n' +
			RANKED_WEEK_STATUS(week, endsAt.toISOString().slice(0, 10), claimed)
		);
	}

	/**
	 * Bracket guard applied identically to both fighters: falling out of a
	 * bracket (decisive loss or a draw that still crosses the line) is
	 * cushioned once by the demotion shield — rating drops only to the old
	 * bracket's floor and the shield breaks; any promotion re-arms it.
	 */
	private resolveRatingChange(
		beforeRating: number,
		rawAfterRating: number,
		hadShield: boolean,
	): { rating: number; shield: boolean; shieldUsed: boolean; promoted: boolean } {
		const before = bracketFor(beforeRating);
		const after = bracketFor(rawAfterRating);
		const index = (b: Bracket) => BRACKETS.findIndex((x) => x.name === b.name);
		let rating = rawAfterRating;
		let shieldUsed = false;
		if (index(after) < index(before) && hadShield) {
			rating = before.min;
			shieldUsed = true;
		}
		const promoted = index(after) > index(before);
		let shield = hadShield;
		if (promoted) shield = true;
		else if (shieldUsed) shield = false;
		return { rating, shield, shieldUsed, promoted };
	}

	/** Persist both fighters' rating/record/log rows for one ranked fight. */
	private async persistRankedOutcome(
		tx: Transaction,
		input: {
			discordId: string;
			me: typeof userCharacter.$inferSelect;
			opponentRow: typeof userCharacter.$inferSelect;
			opponentRatingAfter: number;
			ratingBefore: number;
			ratingAfter: number;
			won: boolean;
			draw: boolean;
			meChange: { shield: boolean; promoted: boolean };
			opponentChange: { shield: boolean; promoted: boolean };
		},
	): Promise<void> {
		const {
			discordId,
			me,
			opponentRow,
			opponentRatingAfter,
			ratingBefore,
			ratingAfter,
			won,
			draw,
			meChange,
			opponentChange,
		} = input;

		if (meChange.promoted && bracketFor(ratingAfter).name !== 'Mortal') {
			// Bracket promotion → rank_season title (challenger/initiator only).
			await this.cosmetics.grantTitleInTx(tx, discordId, `rank_${bracketFor(ratingAfter).name.toLowerCase()}`);
		}

		await this.queries.updateCharacter(tx, discordId, {
			pvpRating: ratingAfter,
			pvpPeak: Math.max(me.pvpPeak, ratingAfter),
			// A fresh promotion re-arms the shield; falling without it breaks it.
			pvpDemotionShield: meChange.shield,
			// Ranked counts toward the PvP win/loss record too (draw = no change).
			pvpWins: me.pvpWins + (won ? 1 : 0),
			pvpLosses: me.pvpLosses + (!won && !draw ? 1 : 0),
		});
		await this.queries.updateCharacter(tx, opponentRow.discordId, {
			pvpRating: opponentRatingAfter,
			pvpPeak: Math.max(opponentRow.pvpPeak, opponentRatingAfter),
			pvpDemotionShield: opponentChange.shield,
			// Draw = no W/L change for either fighter (mirrors the initiator).
			pvpWins: opponentRow.pvpWins + (!won && !draw ? 1 : 0),
			pvpLosses: opponentRow.pvpLosses + (won ? 1 : 0),
		});

		await this.queries.insertLog(tx, {
			playerId: discordId,
			opponentId: opponentRow.discordId,
			result: rankedLogResultOf(draw, won),
			ratingBefore,
			ratingAfter,
		});
		await this.queries.insertLog(tx, {
			playerId: opponentRow.discordId,
			opponentId: discordId,
			result: rankedLogResultOf(draw, !won),
			ratingBefore: opponentRow.pvpRating,
			ratingAfter: opponentRatingAfter,
		});

		const streak = await this.currentWinStreak(tx, discordId);
		await this.queries.updateCharacter(tx, discordId, {
			highestRankStreak: Math.max(me.highestRankStreak, streak),
		});
	}

	/** Opponent: a random non-banned registered player, widening the rating window until someone is found. */
	private async pickOpponentRow(
		tx: Transaction,
		discordId: string,
		rating: number,
	): Promise<typeof userCharacter.$inferSelect | null> {
		for (const window of [RANKED.WINDOW, RANKED.WINDOW * 3, Number.MAX_SAFE_INTEGER]) {
			const [row] = await this.queries.findOpponentInWindow(tx, discordId, rating, window);
			if (row) return row.user_character;
		}
		return null;
	}

	/** Win streak = consecutive wins at the tail of ranked_logs. */
	private async currentWinStreak(tx: Transaction, discordId: string): Promise<number> {
		const logs = await this.queries.findRecentResults(tx, discordId);
		let streak = 0;
		for (const log of logs) {
			if (log.result !== 'win') break;
			streak += 1;
		}
		return streak;
	}
}

/** Giá trị cột result cho ranked_logs: hòa thắng/thua cho `won` của người chiến. */
function rankedLogResultOf(draw: boolean, won: boolean): 'win' | 'loss' | 'draw' {
	if (draw) return 'draw';
	return won ? 'win' : 'loss';
}
