import type { CombatClass } from '../entities/PlayerAccount.js';
import type { IClassStrategy } from './IClassStrategy.js';
import { NullClassStrategy } from './classes/NullClassStrategy.js';
import { SwordsmanStrategy } from './classes/SwordsmanStrategy.js';
import { FighterStrategy } from './classes/FighterStrategy.js';
import { MageStrategy } from './classes/MageStrategy.js';
import { KnightStrategy } from './classes/KnightStrategy.js';
import { ArcherStrategy } from './classes/ArcherStrategy.js';

/**
 * Factory: hands the BattleEngine the right IClassStrategy for a
 * combatant without the engine ever importing a concrete class itself.
 * Adding a 6th class later means: write the Strategy, add one line here.
 */
export class ClassStrategyRegistry {
	private static readonly strategies: Record<CombatClass, IClassStrategy> = {
		Swordsman: new SwordsmanStrategy(),
		Fighter: new FighterStrategy(),
		Mage: new MageStrategy(),
		Knight: new KnightStrategy(),
		Archer: new ArcherStrategy(),
	};

	private static readonly none = new NullClassStrategy();

	static forClass(combatClass: CombatClass | null): IClassStrategy {
		if (!combatClass) return ClassStrategyRegistry.none;
		return ClassStrategyRegistry.strategies[combatClass];
	}
}
