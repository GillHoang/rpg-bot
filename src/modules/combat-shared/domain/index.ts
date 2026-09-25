/**
 * Canonical combat domain entry point. The engine files stay in place for now
 * (20+ test imports); new code imports from here instead of deep paths.
 */
export { BattleEngine, suddenDeathMultiplier } from './BattleEngine.js';
export type { BattleOutcome, BattleResult, BattleRoundLog } from './BattleEngine.js';
export { createCombatant, findDebuff, combatDisplayName } from './CombatantState.js';
export type { CombatantState, BattleFlags, Debuff, DebuffTag } from './CombatantState.js';
export { createBattleFlags } from './CombatantState.js';
export { ClassStrategyRegistry } from './ClassStrategyRegistry.js';
export type { IClassStrategy, StrategyContext } from './IClassStrategy.js';
export { wrapWithRunes, RuneStrategyDecorator } from './RuneStrategyDecorator.js';
export { wrapWithBlessings, DeityBlessingDecorator } from './DeityBlessingDecorator.js';
export { wrapWithWeaponPassive, WeaponPassiveDecorator } from './WeaponPassiveDecorator.js';
export { EffectRegistry } from './EffectRegistry.js';
export type { StrategyHooks } from './EffectRegistry.js';
export { createWeaponPassiveRegistry, DEFAULT_WEAPON_PASSIVE_ENTRIES } from './weaponPassives.js';
export { createRuneEffectRegistry, DEFAULT_RUNE_EFFECT_ENTRIES } from './runeEffects.js';
export { createBlessingEffectRegistry, DEFAULT_BLESSING_EFFECT_ENTRIES } from './blessingEffects.js';
export { MAX_ROUNDS, SUDDEN_DEATH_START } from './combatRules.js';
export type { CombatClass } from '../../identity/domain/PlayerAccount.js';
