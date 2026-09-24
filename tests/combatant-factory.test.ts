import { describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { ClassStrategyRegistry } from '../src/modules/combat-shared/domain/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../src/modules/combat-shared/domain/RuneStrategyDecorator.js';
import { wrapWithBlessings } from '../src/modules/combat-shared/domain/DeityBlessingDecorator.js';
import type { IncomingHit, StrategyContext } from '../src/modules/combat-shared/domain/IClassStrategy.js';
import type { CombatClass } from '../src/modules/identity/domain/PlayerAccount.js';
import type { AssembledPlayer } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { createPlayerCombatant, createPlayerStrategy } from '../src/modules/combat-shared/application/combatantFactory.js';
import { COMBAT_STRIKE_EMOJIS } from '../src/shared/ui/text/combat.js';

// Importing the pure factory must not initialize the production database.
vi.mock('../src/db/client.js', () => {
	throw new Error('Combatant assembly must not import the database at runtime');
});

const classes: CombatClass[] = ['Swordsman', 'Fighter', 'Mage', 'Knight', 'Archer'];

function loadout(decorated = true): AssembledPlayer {
	const assembled: AssembledPlayer = {
		stats: { hp: 4200, atk: 390, def: 170, crit: 23 },
		combatEffectRunes: decorated
			? [
					{ effectKey: 'venom', value: 0.01 },
					{ effectKey: 'vampiric', value: 0.15 },
					{ effectKey: 'aegis_rune', value: 1 },
					{ effectKey: 'warding', value: 0.2 },
				]
			: [],
		blessings: decorated
			? [
					{ key: 'tailwind', strength: 0.5 },
					{ key: 'moon_devourer', strength: 1 },
					{ key: 'guardian_light', strength: 0.5 },
				]
			: [],
	};
	Object.freeze(assembled.stats);
	assembled.combatEffectRunes.forEach(Object.freeze);
	assembled.blessings.forEach(Object.freeze);
	Object.freeze(assembled.combatEffectRunes);
	Object.freeze(assembled.blessings);
	return Object.freeze(assembled);
}

describe('assembled player combatant factory', () => {
	it('copies stats exactly and starts independent mutable combatant state', () => {
		const assembled = loadout();
		const first = createPlayerCombatant('Player', 'Swordsman', assembled);
		const second = createPlayerCombatant('Player', 'Swordsman', assembled);
		expect(first).toEqual({
			name: 'Player',
			emoji: undefined,
			attackEmoji: COMBAT_STRIKE_EMOJIS.bareHand,
			combatClass: 'Swordsman',
			hp: 4200,
			maxHp: 4200,
			atk: 390,
			def: 170,
			crit: 23,
			debuffs: [],
			flags: {},
		});
		expect(first).not.toBe(second);
		expect(first.debuffs).not.toBe(second.debuffs);
		expect(first.flags).not.toBe(second.flags);
		first.hp = 1;
		first.atk += 20;
		first.debuffs.push({ tag: 'burn', turnsLeft: 2, value: 10 });
		first.flags.aegis_used = true;
		expect(second.hp).toBe(4200);
		expect(second.atk).toBe(390);
		expect(second.debuffs).toEqual([]);
		expect(second.flags).toEqual({});
		expect(assembled.stats).toEqual({ hp: 4200, atk: 390, def: 170, crit: 23 });
	});

	it.each(classes)('preserves prior service assembly and seeded battle results for %s', (combatClass) => {
		for (const decorated of [false, true]) {
			const assembled = loadout(decorated);
			for (const seed of [7, 42]) {
				// Independent reference to the composition previously repeated in services.
				const reference = createCombatant({ name: 'Player', combatClass, ...assembled.stats });
				const referenceStrategy = wrapWithBlessings(
					wrapWithRunes(ClassStrategyRegistry.forClass(combatClass), assembled.combatEffectRunes),
					assembled.blessings,
				);
				const actual = createPlayerCombatant('Player', combatClass, assembled);
				const actualStrategy = createPlayerStrategy(combatClass, assembled);
				const enemy = () =>
					createCombatant({ name: 'Enemy', combatClass: 'Mage', hp: 5600, atk: 410, def: 140, crit: 17 });
				const referenceEnemy = enemy();
				const actualEnemy = enemy();
				const referenceResult = new BattleEngine().resolve(reference, referenceEnemy, seed, {
					playerStrategy: referenceStrategy,
				});
				const actualResult = new BattleEngine().resolve(actual, actualEnemy, seed, {
					playerStrategy: actualStrategy,
				});
				expect(actualResult).toEqual(referenceResult);
				expect(actual).toEqual(reference);
				expect(actualEnemy).toEqual(referenceEnemy);
			}
		}
	});

	it('reuses the registry base only when no decorators are needed', () => {
		for (const combatClass of classes) {
			expect(createPlayerStrategy(combatClass, loadout(false))).toBe(ClassStrategyRegistry.forClass(combatClass));
			const assembled = loadout();
			const first = createPlayerStrategy(combatClass, assembled);
			expect(first).not.toBe(ClassStrategyRegistry.forClass(combatClass));
			expect(first).not.toBe(createPlayerStrategy(combatClass, assembled));
		}
	});

	it('keeps one-use rune and blessing flags local to each battle', () => {
		const assembled: AssembledPlayer = {
			stats: { hp: 500, atk: 50, def: 10, crit: 0 },
			combatEffectRunes: [{ effectKey: 'aegis_rune', value: 1 }],
			blessings: [{ key: 'sky_sovereign', strength: 1 }],
		};
		const makeBattle = () => {
			const self = createPlayerCombatant('Player', 'Archer', assembled);
			const ctx: StrategyContext = {
				self,
				enemy: createPlayerCombatant('Enemy', 'Archer', assembled),
				round: 1,
				rng: () => 0.5,
				log: () => {},
			};
			return { self, ctx, strategy: createPlayerStrategy('Archer', assembled) };
		};
		const first = makeBattle();
		const second = makeBattle();
		const incoming = (battle: ReturnType<typeof makeBattle>): IncomingHit => {
			const hit = { reductionFraction: 0 };
			battle.strategy.prepareIncomingHit(battle.ctx, hit);
			return hit;
		};
		expect(incoming(first).reductionFraction).toBe(1);
		expect(incoming(first).reductionFraction).toBe(0);
		expect(second.self.flags).toEqual({});
		expect(incoming(second).reductionFraction).toBe(1);
		expect(first.self.flags).toEqual({ aegis_used: true, blessing_sovereign_used: true });
		expect(incoming(second).reductionFraction).toBe(0);
	});
});
