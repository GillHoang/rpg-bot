import type { RaidResult } from '../services/RaidService.js';
import type { BattleLogPagerOptions } from './BattleLogPager.js';
import {
	RAID_DRAW,
	RAID_LOSE,
	RAID_REWARD_CREDUX,
	RAID_REWARD_EXP,
	RAID_REWARD_LEVEL_UP,
	RAID_REWARD_SHARDS,
	RAID_WIN,
} from '../text/raid.js';
import { ICONS } from '../text/icons.js';

export function raidBattleOptions(
	result: Extract<RaidResult, { status: 'ok' }>,
	boss: boolean,
	playerName: string,
): BattleLogPagerOptions {
	const { battle, monsterName, credux, shards, expGained, gotChest, progress } = result;
	let outcomeLine = RAID_DRAW;
	if (battle.outcome === 'player_win') outcomeLine = RAID_WIN(monsterName);
	else if (battle.outcome === 'enemy_win') outcomeLine = RAID_LOSE(monsterName);

	const headerLines = [
		outcomeLine,
		RAID_REWARD_EXP(expGained.toLocaleString()),
		credux > 0 ? RAID_REWARD_CREDUX(credux.toLocaleString()) : null,
		shards > 0 ? RAID_REWARD_SHARDS(shards) : null,
		gotChest ? `${ICONS.reward.droppedChest} +1 ${result.chestName}` : null,
		result.gearDrop,
		boss ? 'Phí vào boss: -10.000 Credux (reset 00:00 Manila).' : null,
		progress.leveledUp ? RAID_REWARD_LEVEL_UP(progress.previousLevel, progress.newLevel) : null,
	].filter((line): line is string => line !== null);

	return { battle, playerName, enemyName: monsterName, headerLines };
}
