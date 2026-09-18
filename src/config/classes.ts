import type { CombatClass } from '../domain/entities/PlayerAccount.js';

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
 * Base/scaling stats + passive flavor text, ported verbatim from
 * config/classes.js. Display-only here — the authoritative battle
 * calculator will live in domain/combat (M3) and read the same tables.
 */
export const CLASSES: Record<CombatClass, ClassDefinition> = {
	Swordsman: {
		emoji: '⚔️',
		passiveName: 'Bleed',
		base: { hp: 700, atk: 225, def: 225, crit: 5.0 },
		scaling: { hp: 150, atk: 75, def: 75, crit: 0.7 },
		flavor:
			'A warrior forged for the battlefield. Neither the strongest nor the fastest, but the most reliable. ' +
			'The Swordsman walks the line between offense and defense, adapting to any fight. Every strike leaves a mark, and every mark bleeds.',
		passiveLine:
			'**Passive: Bleed** — Attacks inflict 4% Bleed, stacking up to 20%. ' +
			'Gains +5% ATK each turn, stacking up to +30% for the battle.',
	},
	Fighter: {
		emoji: '👊',
		passiveName: 'Stun',
		base: { hp: 850, atk: 300, def: 150, crit: 1.0 },
		scaling: { hp: 150, atk: 100, def: 50, crit: 0.5 },
		flavor:
			'A warrior who does not wait for the fight to come — they bring it. The Fighter is built on aggression, ' +
			'raw power, and the unshakable belief that the best defense is a fist to the jaw.',
		passiveLine:
			'**Passive: Stun** — Attacks deal +50% damage and have a 30% chance to become a Bash. Bash adds another ' +
			'+50% damage, Stuns for 1 turn, and leaves the target Dizzy with a 15% chance to miss its next attack.',
	},
	Mage: {
		emoji: '🔮',
		passiveName: 'Overcharge',
		base: { hp: 600, atk: 350, def: 100, crit: 1.0 },
		scaling: { hp: 100, atk: 150, def: 50, crit: 0.5 },
		flavor:
			'The Mage does not swing a sword. They do not need to. While others close the distance, the Mage is ' +
			'already three moves ahead, building energy that no armor can absorb.',
		passiveLine:
			"**Passive: Overcharge** — Every third battle turn's primary attack rolls 4.0x damage (60%) or 5.0x " +
			'damage (40%), cannot crit, and applies one random 25% debuff: Paralyze, Burn, DEF Down, or ATK Down.',
	},
	Knight: {
		emoji: '🛡️',
		passiveName: 'Damage Reduction',
		base: { hp: 1000, atk: 200, def: 300, crit: 5.0 },
		scaling: { hp: 200, atk: 50, def: 80, crit: 0.0 },
		flavor:
			'The Knight does not fall easily. Where others break under pressure, the Knight absorbs it, holds the ' +
			'line, and keeps fighting.',
		passiveLine:
			'**Passive: Damage Reduction** — Incoming damage is reduced by 25%, outgoing damage is increased by 30%, ' +
			'and the Knight restores 2% of maximum HP every turn.',
	},
	Archer: {
		emoji: '🏹',
		passiveName: 'Armor Pierce & Double Attack',
		base: { hp: 600, atk: 300, def: 150, crit: 5.0 },
		scaling: { hp: 125, atk: 125, def: 50, crit: 0.7 },
		flavor:
			'Swift, precise, and deadly from a distance. The Archer does not wait for the enemy to come — they are ' +
			'already gone before the enemy arrives.',
		passiveLine:
			"**Passive: Armor Pierce & Double Attack** — Attacks ignore 25% of the target's Defense and have a 35% " +
			'chance to immediately perform an additional attack.',
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
