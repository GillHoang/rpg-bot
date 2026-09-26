import type { CombatClass } from '../../identity/domain/PlayerAccount.js';
import { createCombatant, type CombatantState } from '../domain/CombatantState.js';
import { ClassStrategyRegistry } from '../domain/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../domain/RuneStrategyDecorator.js';
import type { RuneEffectParams } from '../domain/runeEffects.js';
import { wrapWithBlessings } from '../domain/DeityBlessingDecorator.js';
import type { BlessingEffectParams } from '../domain/blessingEffects.js';
import { wrapWithWeaponPassive } from '../domain/WeaponPassiveDecorator.js';
import type { EffectRegistry } from '../domain/EffectRegistry.js';
import type { IClassStrategy } from '../domain/IClassStrategy.js';
import type { AssembledPlayer } from './StatAssemblyService.js';

export interface IPlayerCombatantFactory {
	createCombatant(name: string, combatClass: CombatClass, assembled: AssembledPlayer): CombatantState;
	createStrategy(combatClass: CombatClass, assembled: AssembledPlayer): IClassStrategy;
}

export interface CombatantFactoryRegistries {
	weapons?: EffectRegistry<string, undefined>;
	runes?: EffectRegistry<string, RuneEffectParams>;
	blessings?: EffectRegistry<string, BlessingEffectParams>;
}

/** Factory composing fresh battle state with ordered Strategy/Decorator behavior. */
export class PlayerCombatantFactory implements IPlayerCombatantFactory {
	// Registries are pure handler tables (no I/O, no state); callers may
	// inject custom ones (tests, future modes) or take the built-in defaults.
	constructor(private readonly registries: CombatantFactoryRegistries = {}) {}

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
			damageType: assembled.damageType,
			armorType: assembled.armorType,
		});
	}

	/** Preserve the shared class strategy, with fresh weapon, rune then blessing wrappers. */
	createStrategy(combatClass: CombatClass, assembled: AssembledPlayer): IClassStrategy {
		return wrapWithBlessings(
			wrapWithRunes(
				wrapWithWeaponPassive(
					ClassStrategyRegistry.forClass(combatClass),
					assembled.weaponPassive?.passiveKey,
					this.registries.weapons,
				),
				assembled.combatEffectRunes,
				this.registries.runes,
			),
			assembled.blessings,
			this.registries.blessings,
		);
	}
}
