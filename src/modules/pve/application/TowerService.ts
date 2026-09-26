import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { Clock } from '../../../shared/kernel/clock.js';
import { systemClock } from '../../../shared/kernel/clock.js';
import type { Transaction } from '../../../db/client.js';
import { PlayerAccountRepository } from '../../identity/infrastructure/PlayerAccountRepository.js';
import type { PlayerAccount } from '../../identity/domain/PlayerAccount.js';
import { UserCharacterRepository } from '../../identity/infrastructure/UserCharacterRepository.js';
import { MonsterEncounterService, type MonsterStats } from './MonsterEncounterService.js';
import { MonsterStrategy } from '../../combat-shared/domain/classes/MonsterStrategy.js';
import { StatAssemblyService } from '../../combat-shared/application/StatAssemblyService.js';
import { PlayerCombatantFactory } from '../../combat-shared/application/combatantFactory.js';
import { createCombatant } from '../../combat-shared/domain/CombatantState.js';
import { BattleEngine, type BattleResult } from '../../combat-shared/domain/BattleEngine.js';
import { createBattleActionContext } from '../../combat-shared/domain/BattleActionContext.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { RaidRepository } from '../infrastructure/RaidRepository.js';
import { applyCombatExp } from '../../../shared/config/combatExp.js';
import {
	TOWER,
	towerCreduxForFloor,
	towerExpForFloor,
	towerGateModifiers,
	towerLevelForFloor,
	towerMobKind,
} from '../../../shared/config/tower.js';
import { TOWER_TEXT } from '../../../shared/ui/text/tower.js';
import { weekWindowAt } from '../../../shared/config/ranked.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';
import type { RaidRewardResult } from './RaidRewardService.js';

export type TowerResult =
	| { status: 'already-processed' }
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'no-monsters-seeded' }
	| { status: 'tower-locked'; message: string }
	| {
			status: 'ok';
			battle: BattleResult;
			monsterName: string;
			credux: number;
			shards: number;
			expGained: number;
			gotChest: boolean;
			chestName: string;
			gearDrop: string | null;
			progress: RaidRewardResult;
			floor: number;
			newBest: boolean;
			spd?: { player: number; enemy: number };
	  };

export interface TowerRunOptions {
	floor?: number;
	requestId?: string;
}

export interface TowerDependencies {
	accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	monsters?: Pick<MonsterEncounterService, 'pickForLevel'>;
	characters?: Pick<UserCharacterRepository, 'hasCharacter'>;
	statAssembly?: Pick<StatAssemblyService, 'assemble'>;
	events?: Pick<EventBus, 'emit'>;
	clock?: Clock;
	persistence: PersistenceContext;
	queries?: Pick<
		RaidRepository,
		'lockBag' | 'lockCharacter' | 'findReceipt' | 'insertReceipt' | 'updateCharacter' | 'updateBag'
	>;
	engine?: Pick<BattleEngine, 'resolve'>;
	factory?: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;
}

/**
 * Phase 4 Tower mode: endless weekly climb, one battle per attempt.
 * Reuses the portal encounter + combat stack; persists only the weekly best
 * (`tower_floor`/`tower_week`) plus standard credux/EXP — no raid-log writes
 * (tower never feeds raid streaks or quests).
 */
export class TowerService {
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly accounts: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	private readonly monsters: Pick<MonsterEncounterService, 'pickForLevel'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<
		RaidRepository,
		'lockBag' | 'lockCharacter' | 'findReceipt' | 'insertReceipt' | 'updateCharacter' | 'updateBag'
	>;
	private readonly engine: Pick<BattleEngine, 'resolve'>;
	private readonly factory: Pick<PlayerCombatantFactory, 'createCombatant' | 'createStrategy'>;

	constructor(options: TowerDependencies) {
		this.persistence = requirePersistence(options, 'TowerService');
		this.clock = options.clock ?? systemClock;
		this.accounts = options.accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.monsters = options.monsters ?? new MonsterEncounterService();
		this.characters = options.characters ?? new UserCharacterRepository();
		this.statAssembly =
			options.statAssembly ?? new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.events = options.events ?? new EventBus();
		this.queries = options.queries ?? new RaidRepository();
		this.engine = options.engine ?? new BattleEngine();
		this.factory = options.factory ?? new PlayerCombatantFactory();
	}

	async run(discordId: string, options: TowerRunOptions = {}): Promise<TowerResult> {
		const result = await this.persistence.unitOfWork.run((tx) => this.runBattle(tx, discordId, options));
		if (result.status !== 'ok') return result;
		if (result.battle.outcome === 'player_win')
			this.events.emit('battle.won', { discordId, battleType: 'tower', progressApplied: true });
		else if (result.battle.outcome === 'enemy_win')
			this.events.emit('battle.lost', { discordId, battleType: 'tower', progressApplied: true });
		if (result.credux > 0)
			this.events.emit('currency.earned', { discordId, currency: 'credux', amount: result.credux, source: 'tower' });
		if (result.progress.leveledUp) this.events.emit('level.up', { discordId, newLevel: result.progress.newLevel });
		return result;
	}

	private async runBattle(tx: Transaction, discordId: string, options: TowerRunOptions): Promise<TowerResult> {
		if (options.requestId) {
			const [receipt] = await this.queries.findReceipt(tx, discordId, options.requestId);
			if (receipt) return { status: 'already-processed' };
		}
		const [bag] = await this.queries.lockBag(tx, discordId);
		const [character] = await this.queries.lockCharacter(tx, discordId);
		const account = await this.accounts.findByIdWithExecutor(tx, discordId);
		if (!account) return { status: 'not-registered' };
		if (!character || !(await this.characters.hasCharacter(tx, discordId))) return { status: 'no-character' };

		const now = this.clock.now();
		const weekKey = weekWindowAt(now).key;
		const best = character.towerWeek === weekKey ? character.towerFloor : 0;
		const floor = options.floor ?? best + 1;
		if (!Number.isInteger(floor) || floor < 1 || floor > best + 1 || floor > TOWER.maxFloor)
			return { status: 'tower-locked', message: TOWER_TEXT.locked(best) };

		const level = towerLevelForFloor(floor);
		const kind = towerMobKind(floor);
		const gate = towerGateModifiers(floor);
		const lootRng = createRng(createSecureSeed());
		const monsterStats = await this.monsters.pickForLevel(
			tx,
			level,
			lootRng,
			false,
			kind.finalBoss,
			gate.modifier,
			gate.modifier2,
		);
		if (!monsterStats) return { status: 'no-monsters-seeded' };

		const action = createBattleActionContext({ actorId: discordId, mode: 'raid', actionId: options.requestId, now });
		const battle = await this.resolveBattle(tx, discordId, account, monsterStats, action.seed);
		const won = battle.battle.outcome === 'player_win';
		const firstClear = won && floor > best;
		const credux = won ? towerCreduxForFloor(floor, firstClear) : 0;
		const expGained = won ? towerExpForFloor(floor) : 0;
		const next = applyCombatExp(character.combatLevel, character.combatExp, expGained);

		if (won) {
			await this.queries.updateCharacter(tx, discordId, {
				combatLevel: next.level,
				combatExp: next.exp,
				lifetimeExp: character.lifetimeExp + expGained,
				...(firstClear ? { towerFloor: floor, towerWeek: weekKey } : {}),
			});
		}
		if (credux > 0 && bag) {
			await this.queries.updateBag(tx, discordId, {
				credux: bag.credux + credux,
				lifetimeCreduxEarned: bag.lifetimeCreduxEarned + credux,
			});
		}
		if (options.requestId)
			await this.queries.insertReceipt(tx, { discordId, requestId: options.requestId, kind: 'tower' });

		return {
			status: 'ok',
			battle: battle.battle,
			monsterName: TOWER_TEXT.floorLabel(floor, level, kind.finalBoss),
			credux,
			shards: 0,
			expGained,
			gotChest: false,
			chestName: '',
			gearDrop: null,
			progress: { previousLevel: character.combatLevel, newLevel: next.level, leveledUp: next.leveledUp },
			floor,
			newBest: firstClear,
			spd: { player: battle.playerSpd, enemy: battle.enemySpd },
		};
	}

	private async resolveBattle(
		tx: Transaction,
		discordId: string,
		account: PlayerAccount,
		monsterStats: MonsterStats,
		seed: number | undefined,
	): Promise<{ battle: BattleResult; playerSpd: number; enemySpd: number }> {
		const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel, tx);
		const player = this.factory.createCombatant(account.username, account.combatClass, assembled);
		const playerStrategy = this.factory.createStrategy(account.combatClass, assembled);
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
			playerStrategy,
			enemyStrategy: new MonsterStrategy(monsterStats.skillKey, {
				affixes: monsterStats.affixes,
				modifiers: monsterStats.modifiers,
				finalBoss: monsterStats.finalBoss,
			}),
		});
		return { battle, playerSpd: assembled.stats.spd, enemySpd: monsterStats.spd };
	}
}
