import type { GateModifier } from './portals.js';

/**
 * Phase 4 Tower mode (battle-upgrade-plan.md §Trục D): endless climb reusing
 * the portal encounter infra. One battle per attempt — win floor N to unlock
 * N+1. Best floor resets every ISO week (no cron: `tower_week` key gates it).
 */
export const TOWER = {
	/** Hard ceiling for a weekly climb (anti-exploit + UI bound). */
	maxFloor: 100,
	/** Credux per floor on a win (first clear of the week doubles it). */
	creduxPerFloor: 100,
	/** Combat EXP per floor on a win. */
	expPerFloor: 40,
} as const;

/** Monster level for a tower floor — starts past the portal curve, caps at 100. */
export function towerLevelForFloor(floor: number): number {
	return Math.min(100, 55 + Math.max(1, Math.floor(floor)));
}

/** Every 10th floor is a gate-final-style boss; every 5th (non-10th) an elite. */
export function towerMobKind(floor: number): { mobType: 'regular' | 'elite' | 'boss'; finalBoss: boolean } {
	if (floor % 10 === 0) return { mobType: 'boss', finalBoss: true };
	if (floor % 5 === 0) return { mobType: 'elite', finalBoss: false };
	return { mobType: 'regular', finalBoss: false };
}

/** Gate-modifier identity cycles per 10-floor block; deep floors (31+) add enrage. */
export function towerGateModifiers(floor: number): { modifier: GateModifier; modifier2: GateModifier } {
	const cycle: GateModifier[] = ['none', 'tanky', 'aggressive', 'regen', 'evasive'];
	const modifier = cycle[Math.floor((floor - 1) / 10) % cycle.length]!;
	return { modifier, modifier2: floor >= 31 ? 'enrage' : 'none' };
}

/** Credux payout for a won floor (doubled on first clear of the week). */
export function towerCreduxForFloor(floor: number, firstClear: boolean): number {
	return TOWER.creduxPerFloor * floor * (firstClear ? 2 : 1);
}

/** Combat EXP payout for a won floor. */
export function towerExpForFloor(floor: number): number {
	return TOWER.expPerFloor * floor;
}
