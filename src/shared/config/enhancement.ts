import { ENHANCEMENT_ERROR_TEXT } from '../ui/text/diagnostics.js';
import { AppError } from '../kernel/Result.js';
export type GearTier = 'Rare' | 'Mythic' | 'Legendary' | 'Supreme' | 'Divine';

export const MAX_ENHANCEMENT = 11; // stored; display +10
export const DIVINE_MAX_ENHANCEMENT = 21; // stored; display +20
const DIVINE_PRE_10_STEP = 0.1;
const DIVINE_POST_10_STEP = 0.2;

/** stored enhancement (1..11) -> stat multiplier. Armor reuses this same table. */
const BOOST_TABLE: Record<number, number> = {
	1: 1.0,
	2: 1.05,
	3: 1.1,
	4: 1.15,
	5: 1.2,
	6: 1.25,
	7: 1.32,
	8: 1.4,
	9: 1.5,
	10: 1.7,
	11: 2.0,
};

/** target display level (1..10) -> success probability. Divine +11..+20 reuse the +10 rate. */
const SUCCESS_RATE: Record<number, number> = {
	1: 1.0,
	2: 0.95,
	3: 0.85,
	4: 0.75,
	5: 0.65,
	6: 0.55,
	7: 0.4,
	8: 0.3,
	9: 0.2,
	10: 0.1,
};

const ENHANCE_COST: Record<GearTier, Record<number, number>> = {
	Rare: { 1: 1000, 2: 3000, 3: 6000, 4: 12000, 5: 20000, 6: 35000, 7: 55000, 8: 90000, 9: 100000, 10: 100000 },
	Mythic: {
		1: 5000,
		2: 12000,
		3: 25000,
		4: 50000,
		5: 90000,
		6: 150000,
		7: 250000,
		8: 400000,
		9: 650000,
		10: 1000000,
	},
	Legendary: {
		1: 15000,
		2: 35000,
		3: 70000,
		4: 130000,
		5: 220000,
		6: 380000,
		7: 600000,
		8: 900000,
		9: 1500000,
		10: 2000000,
	},
	Supreme: {
		1: 50000,
		2: 100000,
		3: 200000,
		4: 400000,
		5: 650000,
		6: 1000000,
		7: 1500000,
		8: 3000000,
		9: 3000000,
		10: 3000000,
	},
	Divine: {
		1: 50000,
		2: 100000,
		3: 200000,
		4: 400000,
		5: 650000,
		6: 1000000,
		7: 1500000,
		8: 3000000,
		9: 3000000,
		10: 3000000,
		11: 3000000,
		12: 3000000,
		13: 3000000,
		14: 3000000,
		15: 3000000,
		16: 3000000,
		17: 3000000,
		18: 3000000,
		19: 3000000,
		20: 3000000,
	},
};

export function maxStoredEnhancement(tier: GearTier): number {
	return tier === 'Divine' ? DIVINE_MAX_ENHANCEMENT : MAX_ENHANCEMENT;
}

/** Weapons are ATK-only (v5 stat split). */
export function computeWeaponCurrAtk(baseAtk: number, tier: GearTier, enhancement: number): number {
	const stored = Math.floor(enhancement);
	if (tier === 'Divine') {
		const displayLevel = stored - 1;
		const multiplier =
			displayLevel <= 10 ? 1 + displayLevel * DIVINE_PRE_10_STEP : 2 + (displayLevel - 10) * DIVINE_POST_10_STEP;
		return Math.floor(baseAtk * multiplier);
	}
	const m = BOOST_TABLE[stored];
	if (m == null) throw new AppError('ENHANCEMENT_INVALID_WEAPON', ENHANCEMENT_ERROR_TEXT.invalidWeapon(enhancement, tier));
	return Math.floor(baseAtk * m);
}

/** Armor is HP/DEF-only (v5 stat split); reuses the same boost table as weapons, with the same Divine-tier branch. */
export function computeArmorCurrStats(
	baseHp: number,
	baseDef: number,
	enhancement: number,
	tier: GearTier = 'Rare',
): { hp: number; def: number } {
	const stored = Math.floor(enhancement);
	if (tier === 'Divine') {
		const displayLevel = stored - 1;
		const multiplier =
			displayLevel <= 10 ? 1 + displayLevel * DIVINE_PRE_10_STEP : 2 + (displayLevel - 10) * DIVINE_POST_10_STEP;
		return { hp: Math.floor(baseHp * multiplier), def: Math.floor(baseDef * multiplier) };
	}
	const m = BOOST_TABLE[stored];
	if (m == null) throw new AppError('ENHANCEMENT_INVALID_ARMOR', ENHANCEMENT_ERROR_TEXT.invalidArmor(enhancement, tier));
	return { hp: Math.floor(baseHp * m), def: Math.floor(baseDef * m) };
}

export interface EnhanceAttempt {
	targetLevel: number;
	cost: number;
	successRate: number;
}

/** Resolves the next attempt's cost/success-rate, or null if already maxed / tier not enhanceable. */
export function nextAttempt(tier: GearTier, enhancement: number): EnhanceAttempt | null {
	const tierCosts = ENHANCE_COST[tier];
	if (!tierCosts) return null;
	const stored = Math.floor(enhancement || 1);
	if (stored >= maxStoredEnhancement(tier)) return null;
	const targetLevel = stored;
	const cost = tierCosts[targetLevel];
	const successRate = SUCCESS_RATE[Math.min(targetLevel, 10)];
	if (cost == null || successRate == null) return null;
	return { targetLevel, cost, successRate };
}
