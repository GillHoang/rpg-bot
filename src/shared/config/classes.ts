import type { CombatClass } from '../../modules/identity/domain/PlayerAccount.js';
import { CLASS_TEXT } from '../ui/text/classes.js';
import { ICONS } from '../ui/text/icons.js';

export const CLASS_NAMES: readonly CombatClass[] = ['Swordsman', 'Fighter', 'Mage', 'Knight', 'Archer'];

export interface ClassStatBlock {
	hp: number;
	atk: number;
	def: number;
	crit: number;
}

export interface ClassDefinition {
	emoji: string;
	passiveName: string;
	base: ClassStatBlock;
	scaling: ClassStatBlock;
	flavor: string;
	passiveLine: string;
}

/**
 * Base/scaling stats + passive flavor text (text portion lives in
 * text/classes.ts). Display-only here — the authoritative battle
 * calculator will live in domain/combat (M3) and read the same tables.
 */
export const CLASSES: Record<CombatClass, ClassDefinition> = {
	Swordsman: {
		emoji: ICONS.combatClass.swordsman,
		...CLASS_TEXT.Swordsman,
		base: { hp: 700, atk: 225, def: 225, crit: 5.0 },
		scaling: { hp: 150, atk: 75, def: 75, crit: 0.7 },
	},
	Fighter: {
		emoji: ICONS.combatClass.fighter,
		...CLASS_TEXT.Fighter,
		base: { hp: 850, atk: 300, def: 150, crit: 1.0 },
		scaling: { hp: 150, atk: 100, def: 50, crit: 0.5 },
	},
	Mage: {
		emoji: ICONS.combatClass.mage,
		...CLASS_TEXT.Mage,
		base: { hp: 600, atk: 350, def: 100, crit: 1.0 },
		scaling: { hp: 100, atk: 150, def: 50, crit: 0.5 },
	},
	Knight: {
		emoji: ICONS.combatClass.knight,
		...CLASS_TEXT.Knight,
		base: { hp: 1000, atk: 200, def: 300, crit: 5.0 },
		scaling: { hp: 200, atk: 50, def: 80, crit: 0.0 },
	},
	Archer: {
		emoji: ICONS.combatClass.archer,
		...CLASS_TEXT.Archer,
		base: { hp: 600, atk: 300, def: 150, crit: 5.0 },
		scaling: { hp: 125, atk: 125, def: 50, crit: 0.7 },
	},
};

/**
 * Interim display-only stat calculation: base + scaling x (level - 1).
 * Mirrors the authoritative battle calculator that will be ported in M3.
 */
export function computeClassStats(className: CombatClass, level: number): ClassStatBlock {
	const cls = CLASSES[className];
	const steps = Math.max(1, level) - 1;
	return {
		hp: Math.floor(cls.base.hp + cls.scaling.hp * steps),
		atk: Math.floor(cls.base.atk + cls.scaling.atk * steps),
		def: Math.floor(cls.base.def + cls.scaling.def * steps),
		crit: cls.base.crit + cls.scaling.crit * steps,
	};
}

export interface ClassSecondaryStats {
	spd: number;
	acc: number;
	eva: number;
	ten: number;
}

/**
 * Secondary battle stats (P2 rebalance): speed decides turn order,
 * accuracy/evasion decide the hit roll, tenacity can shrug off hard CC entirely.
 * Archer is fast and accurate but fragile; Knight is slow but shrugs
 * off control; the other three sit in the middle with their own lean.
 */
const CLASS_SECONDARY_BASE: Record<CombatClass, ClassSecondaryStats> = {
	Swordsman: { spd: 105, acc: 0, eva: 0, ten: 0 },
	Fighter: { spd: 100, acc: 0, eva: 0, ten: 10 },
	Mage: { spd: 95, acc: 0, eva: 0, ten: 0 },
	Knight: { spd: 85, acc: 0, eva: 0, ten: 25 },
	Archer: { spd: 115, acc: 8, eva: 5, ten: 0 },
};

const CLASS_SECONDARY_SCALING: Record<CombatClass, ClassSecondaryStats> = {
	Swordsman: { spd: 0.5, acc: 0, eva: 0, ten: 0 },
	Fighter: { spd: 0.5, acc: 0, eva: 0, ten: 0 },
	Mage: { spd: 0.5, acc: 0, eva: 0, ten: 0 },
	Knight: { spd: 0.5, acc: 0, eva: 0, ten: 0 },
	Archer: { spd: 0.5, acc: 0.2, eva: 0, ten: 0 },
};

export function computeClassSecondaryStats(className: CombatClass, level: number): ClassSecondaryStats {
	const base = CLASS_SECONDARY_BASE[className];
	const scaling = CLASS_SECONDARY_SCALING[className];
	const steps = Math.max(1, level) - 1;
	return {
		spd: Math.floor(base.spd + scaling.spd * steps),
		acc: base.acc + scaling.acc * steps,
		eva: base.eva + scaling.eva * steps,
		ten: base.ten + scaling.ten * steps,
	};
}
