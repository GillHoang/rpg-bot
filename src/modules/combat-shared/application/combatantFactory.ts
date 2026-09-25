import type { CombatClass } from '../../identity/domain/PlayerAccount.js';
import { createCombatant, type CombatantState } from '../domain/CombatantState.js';
import { ClassStrategyRegistry } from '../domain/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../domain/RuneStrategyDecorator.js';
import { wrapWithBlessings } from '../domain/DeityBlessingDecorator.js';
import { wrapWithWeaponPassive } from '../domain/WeaponPassiveDecorator.js';
import type { IClassStrategy } from '../domain/IClassStrategy.js';
import type { AssembledPlayer } from './StatAssemblyService.js';

export interface IPlayerCombatantFactory {
	createCombatant(name: string, combatClass: CombatClass, assembled: AssembledPlayer): CombatantState;
	createStrategy(combatClass: CombatClass, assembled: AssembledPlayer): IClassStrategy;
}

/** Factory composing fresh battle state with ordered Strategy/Decorator behavior. */
export class PlayerCombatantFactory implements IPlayerCombatantFactory {
	/** Copy assembled player stats into fresh, battle-local mutable state. */
	createCombatant(name: string, combatClass: CombatClass, assembled: AssembledPlayer): CombatantState {
		return createCombatant({
			name,
			combatClass,
			hp: assembled.stats.hp,
			atk: assembled.stats.atk,
			def: assembled.stats.def,
			crit: assembled.stats.crit,
			spd: assembled.stats.spd,
			acc: assembled.stats.acc,
			eva: assembled.stats.eva,
			ten: assembled.stats.ten,
		});
	}

	/** Preserve the shared class strategy, with fresh weapon, rune then blessing wrappers. */
	createStrategy(combatClass: CombatClass, assembled: AssembledPlayer): IClassStrategy {
		return wrapWithBlessings(
			wrapWithRunes(
				wrapWithWeaponPassive(ClassStrategyRegistry.forClass(combatClass), assembled.weaponPassive?.passiveKey),
				assembled.combatEffectRunes,
			),
			assembled.blessings,
		);
	}
}

const defaultFactory = new PlayerCombatantFactory();

/** Compatibility functions; service composition injects the factory interface. */
export const createPlayerCombatant: IPlayerCombatantFactory['createCombatant'] = (...args) =>
	defaultFactory.createCombatant(...args);
export const createPlayerStrategy: IPlayerCombatantFactory['createStrategy'] = (...args) =>
	defaultFactory.createStrategy(...args);
