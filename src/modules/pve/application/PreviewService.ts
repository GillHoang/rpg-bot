import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { Transaction } from '../../../db/client.js';
import { PlayerAccountRepository } from '../../identity/infrastructure/PlayerAccountRepository.js';
import { UserCharacterRepository } from '../../identity/infrastructure/UserCharacterRepository.js';
import { MonsterEncounterService } from './MonsterEncounterService.js';
import { selectGateTier } from './RaidGatePolicy.js';
import { StatAssemblyService } from '../../combat-shared/application/StatAssemblyService.js';
import { PlayerCombatantFactory } from '../../combat-shared/application/combatantFactory.js';
import { createCombatant } from '../../combat-shared/domain/CombatantState.js';
import { BattleEngine } from '../../combat-shared/domain/BattleEngine.js';
import { MonsterStrategy } from '../../combat-shared/domain/classes/MonsterStrategy.js';
import { RaidRepository } from '../infrastructure/RaidRepository.js';

export interface PreviewResult {
	gate: number;
	tier: number;
	monsterName: string;
	monsterLevel: number;
	sims: number;
	wins: number;
	winRate: number;
	avgRounds: number;
	avgDamageDealt: number;
}

export type PreviewStatus =
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'portal-locked'; message: string }
	| { status: 'no-monsters-seeded' }
	| ({ status: 'ok' } & PreviewResult);

/**
 * Phase 6 battle preview: deterministic sims (seeds 1..N) of the current
 * loadout vs a gate/tier — read-only, never writes rewards or progress.
 */
export class PreviewService {
	private readonly persistence: PersistenceContext;
	private readonly accounts: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly monsters: Pick<MonsterEncounterService, 'pickForLevel'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly factory: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
	private readonly queries: Pick<RaidRepository, 'lockCharacter'>;
	private readonly engine: Pick<BattleEngine, 'resolve'>;

	constructor(options: {
		accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
		characters?: Pick<UserCharacterRepository, 'hasCharacter'>;
		monsters?: Pick<MonsterEncounterService, 'pickForLevel'>;
		statAssembly?: Pick<StatAssemblyService, 'assemble'>;
		factory?: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
		queries?: Pick<RaidRepository, 'lockCharacter'>;
		engine?: Pick<BattleEngine, 'resolve'>;
		persistence: PersistenceContext;
	}) {
		this.persistence = requirePersistence(options, 'PreviewService');
		this.accounts = options.accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.characters = options.characters ?? new UserCharacterRepository();
		this.monsters = options.monsters ?? new MonsterEncounterService();
		this.statAssembly =
			options.statAssembly ?? new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.factory = options.factory ?? new PlayerCombatantFactory();
		this.queries = options.queries ?? new RaidRepository();
		this.engine = options.engine ?? new BattleEngine();
	}

	async preview(discordId: string, gate?: number, tier?: number, sims = 100): Promise<PreviewStatus> {
		return this.persistence.unitOfWork.run((tx) => this.runPreview(tx, discordId, gate, tier, sims));
	}

	private async runPreview(
		tx: Transaction,
		discordId: string,
		gate: number | undefined,
		tier: number | undefined,
		sims: number,
	): Promise<PreviewStatus> {
		const [character] = await this.queries.lockCharacter(tx, discordId);
		const account = await this.accounts.findByIdWithExecutor(tx, discordId);
		if (!account) return { status: 'not-registered' };
		if (!character || !(await this.characters.hasCharacter(tx, discordId))) return { status: 'no-character' };
		const gatesCleared = [
			character.gate1TiersCleared,
			character.gate2TiersCleared,
			character.gate3TiersCleared,
			character.gate4TiersCleared,
			character.gate5TiersCleared,
		];
		const selection = selectGateTier(gatesCleared, account.combatLevel, gate, tier);
		if ('status' in selection || !selection.tier) {
			return 'status' in selection ? selection : { status: 'portal-locked', message: 'Gate hoặc tầng không hợp lệ.' };
		}
		const gateTier = selection.tier;

		const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel, tx);
		const count = Math.max(1, Math.min(200, Math.floor(sims)));
		let wins = 0;
		let rounds = 0;
		let damage = 0;
		let monsterName = '';
		for (let seed = 1; seed <= count; seed++) {
			const lootRng = () => (seed % 100) / 100;
			const monsterStats = await this.monsters.pickForLevel(
				tx,
				gateTier.level,
				lootRng,
				false,
				gateTier.finalBoss,
				gateTier.gate.modifier,
				gateTier.gate.modifier2 ?? 'none',
			);
			if (!monsterStats) return { status: 'no-monsters-seeded' };
			monsterName = monsterStats.name;
			const player = this.factory.createCombatant(account.username, account.combatClass, assembled);
			const monster = createCombatant({
				name: monsterStats.name,
				combatClass: null,
				hp: monsterStats.hp,
				atk: monsterStats.atk,
				def: monsterStats.def,
				crit: monsterStats.crit,
				spd: monsterStats.spd,
				acc: monsterStats.acc,
				eva: monsterStats.eva,
				ten: monsterStats.ten,
				damageType: monsterStats.damageType,
				armorType: monsterStats.armorType,
			});
			monster.immunityTags = monsterStats.immunityTags;
			monster.flags.regenPct = monsterStats.regenPct;
			const battle = this.engine.resolve(player, monster, seed, {
				playerStrategy: this.factory.createStrategy(account.combatClass, assembled),
				enemyStrategy: new MonsterStrategy(monsterStats.skillKey, {
					affixes: monsterStats.affixes,
					modifiers: monsterStats.modifiers,
					finalBoss: monsterStats.finalBoss,
				}),
			});
			if (battle.outcome === 'player_win') wins++;
			rounds += battle.rounds;
			damage += monster.maxHp - battle.enemyHpRemaining;
		}
		return {
			status: 'ok',
			gate: gateTier.gate.id,
			tier: gateTier.number,
			monsterName,
			monsterLevel: gateTier.level,
			sims: count,
			wins,
			winRate: wins / count,
			avgRounds: rounds / count,
			avgDamageDealt: Math.round(damage / count),
		};
	}
}
