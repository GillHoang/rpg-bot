import type { BattleResult } from '../../combat-shared/domain/BattleEngine.js';
import type { GateTier } from '../../../shared/config/portals.js';
import type { MonsterStats } from './MonsterEncounterService.js';
import type { RaidRewardResult } from './RaidRewardService.js';

export type RaidResult =
	| { status: 'already-processed' }
	| { status: 'cooldown'; retryAt: Date }
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'no-monsters-seeded' }
	| { status: 'boss-locked'; message: string }
	| { status: 'portal-locked'; message: string }
	| {
			status: 'ok';
			battle: BattleResult;
			monsterName: string;
			credux: number;
			shards: number;
			expGained: number;
			gotChest: boolean;
			chestName: string;
			gearDrop: string | null;
			progress: RaidRewardResult;
			/** Combat SPD of both sides, for the HUD speed bars (absent on legacy/manual results). */
			spd?: { player: number; enemy: number };
	  };

export interface RaidRunOptions {
	gate?: number;
	tier?: number;
	requestId?: string;
	expectedDay?: string;
}

/** Everything the settlement step needs after the battle has resolved. */
export interface RaidSettlement {
	now: Date;
	character: { highestRaidStreak: number };
	combatLevel: number;
	gatesCleared: number[];
	gateTier?: GateTier;
	monsterStats: MonsterStats;
	lootRng: () => number;
	battle: BattleResult;
	playerSpd?: number;
	enemySpd?: number;
}
