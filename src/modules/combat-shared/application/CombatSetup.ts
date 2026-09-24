import type { Executor } from '../../../db/client.js';
import type { CombatClass } from '../../identity/domain/PlayerAccount.js';
import type { BattleResult, BattleEngine } from '../domain/BattleEngine.js';
import type { CombatantState } from '../domain/CombatantState.js';
import type { IClassStrategy } from '../domain/IClassStrategy.js';
import type { AssembledPlayer } from './StatAssemblyService.js';
import type { CombatEnginePort, CombatantFactoryPort, StatAssemblyPort } from './ports.js';

export interface PreparedPlayer {
	assembled: AssembledPlayer;
	combatant: CombatantState;
	strategy: IClassStrategy;
}

/**
 * Bundles the 3-step combat preamble every feature service repeats
 * (assemble → createCombatant → createStrategy) plus engine resolution.
 * Raid/Duel/Ranked will depend on this instead of three separate collaborators.
 */
export class CombatSetup {
	readonly statAssembly: StatAssemblyPort;
	readonly factory: CombatantFactoryPort;
	readonly engine: CombatEnginePort;

	constructor(statAssembly: StatAssemblyPort, factory: CombatantFactoryPort, engine: CombatEnginePort) {
		this.statAssembly = statAssembly;
		this.factory = factory;
		this.engine = engine;
	}

	async preparePlayer(
		discordId: string,
		combatClass: CombatClass,
		level: number,
		username: string,
		executor?: Executor,
	): Promise<PreparedPlayer> {
		const assembled =
			executor === undefined
				? await this.statAssembly.assemble(discordId, combatClass, level)
				: await this.statAssembly.assemble(discordId, combatClass, level, executor);
		return {
			assembled,
			combatant: this.factory.createCombatant(username, combatClass, assembled),
			strategy: this.factory.createStrategy(combatClass, assembled),
		};
	}

	resolve(
		player: CombatantState,
		enemy: CombatantState,
		seed: number,
		overrides?: Parameters<BattleEngine['resolve']>[3],
	): BattleResult {
		return this.engine.resolve(player, enemy, seed, overrides);
	}
}
