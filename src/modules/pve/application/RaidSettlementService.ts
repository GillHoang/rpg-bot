import type { Transaction } from '../../../db/client.js';
import type { RaidRepository } from '../infrastructure/RaidRepository.js';
import type { RaidRewardService } from './RaidRewardService.js';
import type { CosmeticService } from '../../meta/application/CosmeticService.js';
import type { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import type { LootGrantService } from '../../economy/application/LootGrantService.js';
import { BOSS_ENTRY, rollRaidChest } from '../../../shared/config/raidLoot.js';
import { rollBattleRewards, raidMonsterName } from './RaidLoot.js';
import type { RaidResult, RaidRunOptions, RaidSettlement } from './RaidTypes.js';

export interface RaidSettlementDependencies {
	queries: Pick<RaidRepository, 'updateCharacter' | 'insertReceipt'>;
	rewards: Pick<RaidRewardService, 'grant' | 'currentWinStreak'>;
	cosmetics: Pick<CosmeticService, 'grantTitleInTx'>;
	progress: Pick<GameplayProgressCoordinator, 'apply'>;
	loot: Pick<LootGrantService, 'gear'>;
}

/**
 * Owns the post-battle half of a raid: roll rewards, persist streak/extras,
 * append the idempotency receipt and advance quest/reputation progress.
 * Split out of RaidService so the facade keeps only orchestration + gates.
 *
 * Runs inside the caller's transaction and returns a ready `RaidResult`.
 */
export class RaidSettlementService {
	constructor(private readonly deps: RaidSettlementDependencies) {}

	async settle(
		tx: Transaction,
		discordId: string,
		boss: boolean,
		options: RaidRunOptions,
		ctx: RaidSettlement,
	): Promise<RaidResult> {
		const { rewards, queries } = this.deps;
		const won = ctx.battle.outcome === 'player_win';
		const mobType = ctx.gateTier?.finalBoss ? 'final' : ctx.monsterStats.mobType;
		const { credux, shards, expGained, gotChest, chestField, chestName } = rollBattleRewards(
			ctx.lootRng,
			won,
			boss,
			mobType,
			ctx.gateTier?.level ?? ctx.combatLevel,
		);

		const progress = await rewards.grant(tx, discordId, {
			expGain: expGained,
			credux,
			shards,
			grantChest: gotChest,
			chestField,
			boss: boss || ctx.gateTier?.finalBoss,
			battleType: boss ? 'boss' : 'raid',
			enemyName: ctx.monsterStats.name,
			enemyTier: ctx.monsterStats.mobType as 'regular' | 'elite' | 'boss',
			outcome: ctx.battle.outcome,
		});
		if (won && ctx.gateTier)
			await queries.updateCharacter(tx, discordId, {
				[`gate${ctx.gateTier.gate.id}TiersCleared`]: Math.max(
					ctx.gatesCleared[ctx.gateTier.gate.id - 1] ?? 0,
					ctx.gateTier.number,
				),
			});
		await this.updateRaidStreak(tx, discordId, ctx.character.highestRaidStreak, won);
		const gearDrop = await this.grantRaidExtras(tx, discordId, ctx.lootRng, won, boss);
		if (won)
			await this.deps.progress.apply(
				tx,
				discordId,
				ctx.gateTier?.finalBoss ? 'final_boss_win' : 'raid_win',
				ctx.now,
			);
		if (options.requestId)
			await queries.insertReceipt(tx, {
				discordId,
				requestId: options.requestId,
				kind: boss ? 'boss' : 'hunt',
			});
		return {
			status: 'ok',
			battle: ctx.battle,
			monsterName: raidMonsterName(ctx.gateTier, ctx.monsterStats),
			credux,
			shards,
			expGained,
			gotChest,
			chestName,
			gearDrop,
			progress,
			spd:
				ctx.playerSpd != null && ctx.enemySpd != null
					? { player: ctx.playerSpd, enemy: ctx.enemySpd }
					: undefined,
		};
	}

	/** Win streak from the raid_logs tail that grant() just appended to; only the record streak is persisted. */
	private async updateRaidStreak(
		tx: Transaction,
		discordId: string,
		highestRaidStreak: number,
		won: boolean,
	): Promise<void> {
		if (!won) return;
		const streak = await this.deps.rewards.currentWinStreak(tx, discordId);
		if (streak > highestRaidStreak) {
			await this.deps.queries.updateCharacter(tx, discordId, { highestRaidStreak: streak });
		}
		if (streak >= 10) {
			// Chuỗi thắng raid 10 — title Unstoppable (idempotent).
			await this.deps.cosmetics.grantTitleInTx(tx, discordId, 'streak_master');
		}
	}

	/** Boss-only extras: the Bakunawa Slayer title and the 30% Mythic gear drop. */
	private async grantRaidExtras(
		tx: Transaction,
		discordId: string,
		lootRng: () => number,
		won: boolean,
		boss: boolean,
	): Promise<string | null> {
		if (!won || !boss) return null;
		await this.deps.cosmetics.grantTitleInTx(tx, discordId, 'boss_slayer');
		if (rollRaidChest(lootRng, BOSS_ENTRY.gearChance)) {
			return this.deps.loot.gear(tx, discordId, 'Mythic', lootRng);
		}
		return null;
	}
}
