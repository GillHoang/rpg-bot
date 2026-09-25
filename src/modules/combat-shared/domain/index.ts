/**
 * Canonical combat domain entry point. The engine files stay in place for now
 * (20+ test imports); new code imports from here instead of deep paths.
 */
export { BattleEngine, suddenDeathMultiplier } from './BattleEngine.js';
export type { BattleOutcome, BattleResult, BattleRoundLog } from './BattleEngine.js';
export { createCombatant, findDebuff, combatDisplayName } from './CombatantState.js';
export type { CombatantState, Debuff, DebuffTag } from './CombatantState.js';
export { ClassStrategyRegistry } from './ClassStrategyRegistry.js';
export type { IClassStrategy, StrategyContext } from './IClassStrategy.js';
export { wrapWithRunes } from './RuneStrategyDecorator.js';
export { wrapWithBlessings } from './DeityBlessingDecorator.js';
export { wrapWithWeaponPassive, WeaponPassiveDecorator } from './WeaponPassiveDecorator.js';
export { MAX_ROUNDS, SUDDEN_DEATH_START } from './combatRules.js';
export type { CombatClass } from '../../identity/domain/PlayerAccount.js';
