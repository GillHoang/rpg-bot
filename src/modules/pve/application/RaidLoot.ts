import { GATE_TEXT } from '../../../shared/ui/text/portals.js';
import { LOOT_CHEST_NAMES } from '../../../shared/ui/text/loot.js';
import type { GateTier } from '../../../shared/config/portals.js';
import {
	RAID_LOOT_REGULAR,
	RAID_LOOT_ELITE,
	RAID_LOOT_BOSS,
	randInt,
	rollRaidChest,
} from '../../../shared/config/raidLoot.js';
import { scaleExpForMobLevel } from '../../../shared/config/expScaling.js';
import type { MonsterStats } from './MonsterEncounterService.js';

/** Chest column + display name chosen for one raid/boss reward roll. */
export interface RaidChestOutcome {
	chestField: 'silverChest' | 'goldChest' | 'bossTreasureChest';
	chestName: string;
}

export interface RaidBattleRewards extends RaidChestOutcome {
	credux: number;
	shards: number;
	expGained: number;
	gotChest: boolean;
}

/**
 * Pure raid reward table selection + roll. Extracted from RaidService so the
 * facade only orchestrates; all randomness flows through the caller's seeded
 * `lootRng`.
 */
export function rollBattleRewards(
	lootRng: () => number,
	won: boolean,
	boss: boolean,
	mobType: string,
	combatLevel: number,
): RaidBattleRewards {
	let table: typeof RAID_LOOT_BOSS | typeof RAID_LOOT_ELITE | typeof RAID_LOOT_REGULAR = RAID_LOOT_REGULAR;
	let chestField: RaidChestOutcome['chestField'] = 'silverChest';
	let chestName: string = LOOT_CHEST_NAMES.silver;
	if (boss) {
		table = RAID_LOOT_BOSS;
		chestField = 'bossTreasureChest';
		chestName = LOOT_CHEST_NAMES.boss;
	} else if (mobType === 'final' || mobType === 'elite') {
		// Final Boss gate & elite: thưởng bậc Elite (final miễn phí, không đụng daily boss fee).
		table = RAID_LOOT_ELITE;
		chestField = 'goldChest';
		chestName = LOOT_CHEST_NAMES.gold;
	}
	let credux = 0;
	let shards = 0;
	let baseExp: number;
	let gotChest = false;

	if (won) {
		credux = randInt(lootRng, table.win.creduxRange);
		baseExp = randInt(lootRng, table.win.expRange);
		shards = randInt(lootRng, table.win.shardsRange);
		gotChest = rollRaidChest(lootRng, table.win.chestChance);
	} else {
		baseExp = table.loss.exp;
	}
	const expGained = scaleExpForMobLevel(baseExp, combatLevel);
	return { credux, shards, expGained, gotChest, chestField, chestName };
}

/** Tên hiển thị của encounter: tiền tố portal (Gate/Tầng) + tên quái + bậc. */
export function raidMonsterName(gateTier: GateTier | undefined, monsterStats: MonsterStats): string {
	const prefix = gateTier ? `${GATE_TEXT.gate(gateTier)} · ` : '';
	return `${prefix}${monsterStats.name} [${monsterStats.mobType}]`;
}
