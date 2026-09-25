import { formatNumber } from '../text/format.js';
import {
	RAID_FOOTER_TEXT,
	RAID_DRAW,
	RAID_LOSE,
	RAID_REWARD_CREDUX,
	RAID_REWARD_EXP,
	RAID_REWARD_LEVEL_UP,
	RAID_REWARD_SHARDS,
	RAID_SPD_LINE,
	RAID_WIN,
} from '../text/raid.js';
import type { RaidResult } from '../../../modules/pve/application/RaidService.js';
import type { BattleLogPagerOptions } from './BattleLogPager.js';
import { renderProgressBar } from '../../utils/progressBar.js';

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

	// SPD bars are scaled to the faster side so the faster combatant reads as full.
	const spdMax = Math.max(result.spd?.player ?? 0, result.spd?.enemy ?? 0, 1);
	const spdLine = result.spd
		? RAID_SPD_LINE(
				playerName,
				renderProgressBar({ current: result.spd.player, max: spdMax, cells: 6, color: 'blue' }),
				result.spd.player,
				monsterName,
				renderProgressBar({ current: result.spd.enemy, max: spdMax, cells: 6, color: 'green' }),
				result.spd.enemy,
			)
		: null;

	const headerLines = [
		outcomeLine,
		spdLine,
		RAID_REWARD_EXP(formatNumber(expGained)),
		credux > 0 ? RAID_REWARD_CREDUX(formatNumber(credux)) : null,
		shards > 0 ? RAID_REWARD_SHARDS(shards) : null,
		gotChest ? `${ICONS.reward.droppedChest} +1 ${result.chestName}` : null,
		result.gearDrop,
		boss ? RAID_FOOTER_TEXT.bossFee : null,
		progress.leveledUp ? RAID_REWARD_LEVEL_UP(progress.previousLevel, progress.newLevel) : null,
	].filter((line): line is string => line !== null);

	return { battle, playerName, enemyName: monsterName, headerLines };
}
