import { RAID_REWARD_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { AppError } from '../../../shared/kernel/Result.js';
import type { Executor } from '../../../db/client.js';
import { RaidRewardStore, type RaidRewardBag } from '../infrastructure/RaidRewardStore.js';
import { applyCombatExp } from '../../../shared/config/combatExp.js';
import type { BattleOutcome } from '../../combat-shared/domain/BattleEngine.js';

export interface RaidRewardGrant {
	expGain: number; // already scaled by scaleExpForMobLevel
	credux: number;
	shards: number;
	grantChest: boolean;
	chestField?: 'silverChest' | 'goldChest' | 'bossTreasureChest';
	boss?: boolean;
	/** Battle metadata for the raid_logs history row. */
	battleType: 'raid' | 'boss';
	enemyName: string;
	enemyTier: 'regular' | 'elite' | 'boss';
	outcome: BattleOutcome;
}

export interface RaidRewardResult {
	previousLevel: number;
	newLevel: number;
	leveledUp: boolean;
}

/** Kết quả hiển thị trong raid_logs — tách riêng để tránh ternary lồng nhau. */
function battleResultLabel(won: boolean, lost: boolean): 'win' | 'loss' | 'draw' {
	if (won) return 'win';
	if (lost) return 'loss';
	return 'draw';
}

/**
 * Ported from utils/awardCombatExp.js + the credux/shard/chest half of
 * commands/rpg/raid.js. Only `combat_level`/`combat_exp`/`lifetime_exp`
 * are updated here — per-level reward grants (utils/grantLevelRewards.js)
 * are a separate subsystem, deferred to a later milestone.
 */
export class RaidRewardService {
	constructor(
		private readonly store: Pick<
			RaidRewardStore,
			| 'lockBag'
			| 'lockCharacter'
			| 'updateCharacter'
			| 'updateBag'
			| 'insertGameLog'
			| 'insertRaidLog'
			| 'currentWinStreak'
		> = new RaidRewardStore(),
	) {}

	async grant(executor: Executor, discordId: string, grant: RaidRewardGrant): Promise<RaidRewardResult> {
		const lockedBag = await this.store.lockBag(executor, discordId);
		const character = await this.store.lockCharacter(executor, discordId);
		if (!character) throw new AppError('RAID_REWARD_MISSING_CHARACTER', RAID_REWARD_ERROR_TEXT.missingCharacter(discordId));
		if (!lockedBag) throw new AppError('RAID_REWARD_MISSING_BAG', RAID_REWARD_ERROR_TEXT.missingBag(discordId));
		const bag = lockedBag;
		const next = applyCombatExp(character.combatLevel, character.combatExp, grant.expGain);
		const won = grant.outcome === 'player_win';
		const lost = grant.outcome === 'enemy_win';

		await this.store.updateCharacter(executor, discordId, {
			combatLevel: next.level,
			combatExp: next.exp,
			lifetimeExp: character.lifetimeExp + Math.max(0, grant.expGain),
			bossKills: character.bossKills + (grant.boss && won ? 1 : 0),
			raidsWon: !grant.boss && won ? character.raidsWon + 1 : character.raidsWon,
			// Shared defeat counter for regular raids and daily bosses; draws do not count.
			raidsLost: lost ? character.raidsLost + 1 : character.raidsLost,
		});

		const creuxAfter = bag.credux + grant.credux;
		const shardsAfter = bag.beliefShards + grant.shards;
		const chestField = grant.chestField ?? 'silverChest';
		const chestAfter = bag[chestField] + (grant.grantChest ? 1 : 0);

		if (grant.credux > 0 || grant.shards > 0 || grant.grantChest) {
			await this.store.updateBag(executor, discordId, {
				credux: creuxAfter,
				beliefShards: shardsAfter,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + grant.credux,
				[chestField]: chestAfter,
			});
			await this.logRaidCurrency(executor, discordId, grant, bag, creuxAfter, chestField, chestAfter);
		}

		// History row for every battle — win or loss (the table was previously
		// never written; raid streaks below depend on it).
		await this.store.insertRaidLog(executor, {
			discordId,
			battleType: grant.battleType,
			enemyName: grant.enemyName,
			enemyTier: grant.enemyTier,
			result: battleResultLabel(won, lost),
			expEarned: grant.expGain,
			updatedExp: next.exp,
			beliefShardsDropped: grant.shards,
			updatedBeliefShards: shardsAfter,
			creduxEarned: grant.credux,
			updatedCredux: creuxAfter,
			chestDropped: grant.grantChest ? chestField : null,
		});

		return { previousLevel: character.combatLevel, newLevel: next.level, leveledUp: next.leveledUp };
	}

	private async logRaidCurrency(
		executor: Executor,
		discordId: string,
		grant: RaidRewardGrant,
		bag: RaidRewardBag,
		creuxAfter: number,
		chestField: 'silverChest' | 'goldChest' | 'bossTreasureChest',
		chestAfter: number,
	): Promise<void> {
		if (grant.credux > 0) {
			await this.store.insertGameLog(executor, {
				discordId,
				action: 'Raid',
				previousCredux: bag.credux,
				updatedCredux: creuxAfter,
			});
		}
		if (grant.grantChest) {
			await this.store.insertGameLog(executor, {
				discordId,
				action: 'Raid',
				itemType: chestField,
				previousChestCount: bag[chestField],
				updatedChestCount: chestAfter,
			});
		}
	}

	/** Consecutive wins at the tail of raid_logs — for highestRaidStreak. */
	async currentWinStreak(executor: Executor, discordId: string): Promise<number> {
		return this.store.currentWinStreak(executor, discordId);
	}
}
