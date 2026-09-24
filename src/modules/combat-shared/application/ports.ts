import type { BattleEngine } from '../domain/BattleEngine.js';
import type { StatAssemblyService } from './StatAssemblyService.js';
import type { PlayerCombatantFactory } from './combatantFactory.js';

/** Ports the combat setup orchestrator depends on — all have direct implementations today. */
export type CombatEnginePort = Pick<BattleEngine, 'resolve'>;
export type StatAssemblyPort = Pick<StatAssemblyService, 'assemble'>;
export type CombatantFactoryPort = Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
