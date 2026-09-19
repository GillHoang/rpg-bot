import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { activeRankedFights, rankedLogs, rankedReward, seasons, users, usersBag, userCharacter } from '../db/schema.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { CosmeticService } from './CosmeticService.js';
import { createCombatant } from '../domain/combat/CombatantState.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { ClassStrategyRegistry } from '../domain/combat/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../domain/combat/RuneStrategyDecorator.js';
import { wrapWithBlessings } from '../domain/combat/DeityBlessingDecorator.js';
import { createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';
import { BRACKETS, RANKED, bracketFor, eloDelta, weekWindowAt, type Bracket } from '../config/ranked.js';
import type { AssembledPlayer } from './StatAssemblyService.js';
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

/**
 * Ranked PvP — async mirror match (M7): loadout hiện tại của một người chơi
 * ngẫu nhiên (rating chênh trong cửa sổ matchmaking) làm đối thủ; không cần
 * cả hai online. Elo K=32 zero-sum, bracket theo rating, demotion shield giữ
 * bracket lần rớt đầu tiên. Thưởng tuần claim theo bảng ranked_reward, điều
 * kiện ≥1 trận trong tuần ISO (Manila).
 */
export class RankedService {
	constructor(
		private readonly accounts = new PlayerAccountRepository(),
		private readonly statAssembly = new StatAssemblyService(),
		private readonly cosmetics = new CosmeticService(),
		private readonly events = EventBus.getInstance(),
	) {}

	async fight(discordId: string): Promise<RankedFightResult> {
		const result = await db.transaction(async (tx): Promise<RankedFightResult> => {
			const [account] = await tx.select().from(users).where(eq(users.discordId, discordId)).limit(1);
			if (!account) return { status: 'not-registered' };
			const [me] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1)
				.for('update');
			if (!me) return { status: 'no-character' };
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1).for('update');

			const [lock] = await tx
				.insert(activeRankedFights)
				.values({
					discordId,
					lockToken: crypto.randomUUID(),
					expiresAt: new Date(Date.now() + RANKED.LOCK_SECONDS * 1000),
				})
				.onConflictDoNothing()
				.returning();
			if (!lock) return { status: 'busy' };

			// Opponent: random registered player, nearest rating window first.
			const windows = [RANKED.WINDOW, RANKED.WINDOW * 3, Number.MAX_SAFE_INTEGER];
			let opponentRow: typeof userCharacter.$inferSelect | undefined;
			for (const window of windows) {
				const [row] = await tx
					.select()
					.from(userCharacter)
					.innerJoin(users, eq(users.discordId, userCharacter.discordId))
					.where(
						and(
							ne(userCharacter.discordId, discordId),
							eq(users.isBanned, false),
							sql`abs(${userCharacter.pvpRating} - ${me.pvpRating}) <= ${window}`,
						),
					)
					.orderBy(sql`random()`)
					.limit(1);
				if (row) {
					opponentRow = row.user_character;
					break;
				}
			}
			if (!opponentRow) return { status: 'no-opponent' };

			const opponentAccount = await this.accounts.findByIdWithExecutor(tx, opponentRow.discordId);
			if (!opponentAccount) return { status: 'no-opponent' };

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

			const battle = new BattleEngine().resolve(
				createCombatant({
					name: account.username,
					combatClass: accountCombatClass(me.class),
					hp: myAssembled.stats.hp,
					atk: myAssembled.stats.atk,
					def: myAssembled.stats.def,
					crit: myAssembled.stats.crit,
				}),
				createCombatant({
					name: opponentAccount.username,
					combatClass: opponentAccount.combatClass,
					hp: opponentAssembled.stats.hp,
					atk: opponentAssembled.stats.atk,
					def: opponentAssembled.stats.def,
					crit: opponentAssembled.stats.crit,
				}),
				createSecureSeed(),
				{
					playerStrategy: this.buildStrategy(accountCombatClass(me.class), myAssembled),
					enemyStrategy: this.buildStrategy(opponentAccount.combatClass, opponentAssembled),
				},
			);

			const won = battle.outcome === 'player_win';
			const draw = battle.outcome === 'draw';
			const score = won ? 1 : draw ? 0.5 : 0;
			const delta = eloDelta(me.pvpRating, opponentRow.pvpRating, score);
			const opponentDelta = eloDelta(opponentRow.pvpRating, me.pvpRating, (1 - score) as 0 | 0.5 | 1);

			const ratingBefore = me.pvpRating;
			let ratingAfter = Math.max(0, ratingBefore + (won ? delta : -delta));
			const opponentRatingAfter = Math.max(0, opponentRow.pvpRating - opponentDelta);

			const bracketBefore = bracketFor(ratingBefore);
			const bracketAfter = bracketFor(ratingAfter);
			let shieldUsed = false;
			if (!won && !draw && bracketAfter.name !== bracketBefore.name) {
				// First fall out of a bracket is cushioned by the demotion shield:
				// rating drops only to the old bracket's floor and the shield breaks.
				if (me.pvpDemotionShield) {
					ratingAfter = bracketBefore.min;
					shieldUsed = true;
				}
			}
			const promoted =
				BRACKETS.findIndex((b) => b.name === bracketAfter.name) >
				BRACKETS.findIndex((b) => b.name === bracketBefore.name);
			if (promoted && bracketAfter.name !== 'Mortal') {
				// Bracket promotion → rank_season title (challenger/initiator only).
				await this.cosmetics.grantTitleInTx(tx, discordId, `rank_${bracketAfter.name.toLowerCase()}`);
			}

			await tx
				.update(userCharacter)
				.set({
					pvpRating: ratingAfter,
					pvpPeak: Math.max(me.pvpPeak, ratingAfter),
					// A fresh promotion re-arms the shield; falling without it breaks it.
					pvpDemotionShield: promoted ? true : shieldUsed ? false : me.pvpDemotionShield,
				})
				.where(eq(userCharacter.discordId, discordId));
			await tx
				.update(userCharacter)
				.set({ pvpRating: opponentRatingAfter })
				.where(eq(userCharacter.discordId, opponentRow.discordId));

			await tx.insert(rankedLogs).values({
				playerId: discordId,
				opponentId: opponentRow.discordId,
				result: won ? 'win' : 'loss',
				ratingBefore,
				ratingAfter,
			});
			await tx.insert(rankedLogs).values({
				playerId: opponentRow.discordId,
				opponentId: discordId,
				result: won ? 'loss' : 'win',
				ratingBefore: opponentRow.pvpRating,
				ratingAfter: opponentRatingAfter,
			});

			const streak = await this.currentWinStreak(tx, discordId);
			await tx
				.update(userCharacter)
				.set({ highestRankStreak: Math.max(me.highestRankStreak, streak) })
				.where(eq(userCharacter.discordId, discordId));

			await this.ensureActiveSeason(tx);
			await tx.delete(activeRankedFights).where(eq(activeRankedFights.discordId, discordId));

			return {
				status: 'ok',
				battle,
				opponentId: opponentRow.discordId,
				opponentName: opponentAccount.username,
				won,
				draw,
				ratingBefore,
				ratingAfter,
				bracketBefore: bracketBefore.name,
				bracketAfter: shieldUsed ? bracketBefore.name : bracketAfter.name,
				peak: Math.max(me.pvpPeak, ratingAfter),
				shieldUsed,
				delta: ratingAfter - ratingBefore,
			};
		});

		if (result.status === 'ok') {
			this.events.emit(result.won ? 'battle.won' : 'battle.lost', { discordId, battleType: 'ranked' });
			this.events.emit(result.won ? 'battle.lost' : 'battle.won', {
				discordId: result.opponentId,
				battleType: 'ranked',
			});
		}
		return result;
	}

	async claim(discordId: string): Promise<RankedClaimResult> {
		return db.transaction(async (tx): Promise<RankedClaimResult> => {
			const [me] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1)
				.for('update');
			if (!me) return { status: 'not-registered' };
			const { week, startsAt } = weekWindowAt();
			if (me.lastWeeklyClaimWeek === week) return { status: 'already-claimed' };

			const [fight] = await tx
				.select({ id: rankedLogs.id })
				.from(rankedLogs)
				.where(and(eq(rankedLogs.playerId, discordId), gte(rankedLogs.timestamp, startsAt)))
				.limit(1);
			if (!fight) return { status: 'no-fights' };

			const bracket = bracketFor(me.pvpRating);
			const [reward] = await tx
				.select()
				.from(rankedReward)
				.where(eq(rankedReward.bracket, bracket.name))
				.limit(1);
			if (!reward) return { status: 'no-reward-row' };

			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) return { status: 'not-registered' };
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
			await tx.update(usersBag).set(patch).where(eq(usersBag.discordId, discordId));
			await tx
				.update(userCharacter)
				.set({ lastWeeklyClaimWeek: week })
				.where(eq(userCharacter.discordId, discordId));

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
		const [me] = await db.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1);
		if (!me) return 'Dùng /register trước.';
		const bracket = bracketFor(me.pvpRating);
		const { week, endsAt } = weekWindowAt();
		const claimed = me.lastWeeklyClaimWeek === week;
		return (
			`🏅 **Ranked** — Rating **${me.pvpRating}** (${bracket.name}) · Peak **${me.pvpPeak}**\n` +
			`PvP ${me.pvpWins}W / ${me.pvpLosses}L · Streak kỷ lục ${me.highestRankStreak} · ` +
			`Demotion shield: ${me.pvpDemotionShield ? 'bật' : 'đã mất'}\n` +
			`Thưởng tuần ${week} (reset ${endsAt.toISOString().slice(0, 10)}): ${claimed ? 'đã claim' : 'chưa claim — /ranked claim'}`
		);
	}

	/** Win streak = consecutive wins at the tail of ranked_logs. */
	private async currentWinStreak(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		discordId: string,
	): Promise<number> {
		const logs = await tx
			.select({ result: rankedLogs.result })
			.from(rankedLogs)
			.where(eq(rankedLogs.playerId, discordId))
			.orderBy(desc(rankedLogs.id))
			.limit(50);
		let streak = 0;
		for (const log of logs) {
			if (log.result !== 'win') break;
			streak += 1;
		}
		return streak;
	}

	private async ensureActiveSeason(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<void> {
		const [active] = await tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
		if (active) return;
		const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(seasons);
		await tx.insert(seasons).values({
			name: `Season ${count + 1}`,
			startsAt: new Date(),
			endsAt: new Date(Date.now() + 30 * 86_400_000),
			isActive: true,
		});
	}

	private buildStrategy(combatClass: CombatClass, assembled: AssembledPlayer) {
		return wrapWithBlessings(
			wrapWithRunes(ClassStrategyRegistry.forClass(combatClass), assembled.combatEffectRunes),
			assembled.blessings,
		);
	}
}
