import type { CombatClass } from '../domain/entities/PlayerAccount.js';

/**
 * Text lore/passive của từng lớp nhân vật (tách từ config/classes.ts).
 * Phần số liệu (base/scaling/emoji) vẫn nằm ở config/classes.ts.
 */
export interface ClassText {
	passiveName: string;
	flavor: string;
	passiveLine: string;
}

export const CLASS_TEXT: Record<CombatClass, ClassText> = {
	Swordsman: {
		passiveName: 'Bleed',
		flavor:
			'A warrior forged for the battlefield. Neither the strongest nor the fastest, but the most reliable. ' +
			'The Swordsman walks the line between offense and defense, adapting to any fight. Every strike leaves a mark, and every mark bleeds.',
		passiveLine:
			'**Passive: Bleed** — Attacks inflict 4% Bleed, stacking up to 20%. ' +
			'Gains +5% ATK each turn, stacking up to +30% for the battle.',
	},
	Fighter: {
		passiveName: 'Stun',
		flavor:
			'A warrior who does not wait for the fight to come — they bring it. The Fighter is built on aggression, ' +
			'raw power, and the unshakable belief that the best defense is a fist to the jaw.',
		passiveLine:
			'**Passive: Stun** — Attacks deal +50% damage and have a 30% chance to become a Bash. Bash adds another ' +
			'+50% damage, Stuns for 1 turn, and leaves the target Dizzy with a 15% chance to miss its next attack.',
	},
	Mage: {
		passiveName: 'Overcharge',
		flavor:
			'The Mage does not swing a sword. They do not need to. While others close the distance, the Mage is ' +
			'already three moves ahead, building energy that no armor can absorb.',
		passiveLine:
			"**Passive: Overcharge** — Every third battle turn's primary attack rolls 4.0x damage (60%) or 5.0x " +
			'damage (40%), cannot crit, and applies one random 25% debuff: Paralyze, Burn, DEF Down, or ATK Down.',
	},
	Knight: {
		passiveName: 'Damage Reduction',
		flavor:
			'The Knight does not fall easily. Where others break under pressure, the Knight absorbs it, holds the ' +
			'line, and keeps fighting.',
		passiveLine:
			'**Passive: Damage Reduction** — Incoming damage is reduced by 25%, outgoing damage is increased by 30%, ' +
			'and the Knight restores 2% of maximum HP every turn.',
	},
	Archer: {
		passiveName: 'Armor Pierce & Double Attack',
		flavor:
			'Swift, precise, and deadly from a distance. The Archer does not wait for the enemy to come — they are ' +
			'already gone before the enemy arrives.',
		passiveLine:
			"**Passive: Armor Pierce & Double Attack** — Attacks ignore 25% of the target's Defense and have a 35% " +
			'chance to immediately perform an additional attack.',
	},
};
