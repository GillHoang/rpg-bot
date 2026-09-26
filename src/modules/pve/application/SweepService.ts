import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import type { Clock } from '../../../shared/kernel/clock.js';
import { systemClock } from '../../../shared/kernel/clock.js';
import type { Transaction } from '../../../db/client.js';
import { PlayerAccountRepository } from '../../identity/infrastructure/PlayerAccountRepository.js';
import { UserCharacterRepository } from '../../identity/infrastructure/UserCharacterRepository.js';
import { MonsterEncounterService, type MonsterStats } from './MonsterEncounterService.js';
import { selectGateTier } from './RaidGatePolicy.js';
import { RaidRepository } from '../infrastructure/RaidRepository.js';
import { RaidRewardService, type RaidRewardResult } from './RaidRewardService.js';
import { rollBattleRewards, raidMonsterName } from './RaidLoot.js';
import { GATE_TEXT } from '../../../shared/ui/text/portals.js';
import { SWEEP_TEXT } from '../../../shared/ui/text/raid.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { RAID_HUNT_COOLDOWN_SECONDS } from '../../../shared/config/raidLoot.js';
import { EventBus } from '../../../shared/kernel/EventBus.js';

/** Sweep tax: instant clears pay 60% credux/EXP and never drop chests. */
export const SWEEP_RATE = 0.6;

export type SweepResult =
	| { status: 'already-processed' }
	| { status: 'cooldown'; retryAt: Date }
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'no-monsters-seeded' }
	| { status: 'portal-locked'; message: string }
	| { status: 'sweep-locked'; message: string }
	| {
			status: 'ok';
			gate: number;
			tier: number;
			monsterName: string;
			credux: number;
			shards: number;
			expGained: number;
			progress: RaidRewardResult;
	  };

/**
 * Phase 6 sweep: instantly re-clear an already-cleared tier at reduced
 * rewards. Consumes the hunt cooldown like a real hunt; never drops chests
 * or gear, never counts boss kills — the log stays honest.
 */
export class SweepService {
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
	private readonly accounts: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly monsters: Pick<MonsterEncounterService, 'pickForLevel'>;
	private readonly rewards: Pick<RaidRewardService, 'grant'>;
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<
		RaidRepository,
		| 'lockBag'
		| 'lockCharacter'
		| 'findReceipt'
		| 'insertReceipt'
		| 'lockHuntCooldown'
		| 'upsertHuntCooldown'
	>;
	private readonly huntCooldownSeconds: number;

	constructor(options: {
		accounts?: Pick<PlayerAccountRepository, 'findByIdWithExecutor'>;
		characters?: Pick<UserCharacterRepository, 'hasCharacter'>;
		monsters?: Pick<MonsterEncounterService, 'pickForLevel'>;
		rewards?: Pick<RaidRewardService, 'grant'>;
		progress?: Pick<GameplayProgressCoordinator, 'apply'>;
		events?: Pick<EventBus, 'emit'>;
		clock?: Clock;
		persistence: PersistenceContext;
		queries?: Pick<
			RaidRepository,
			| 'lockBag'
			| 'lockCharacter'
			| 'findReceipt'
			| 'insertReceipt'
			| 'lockHuntCooldown'
			| 'upsertHuntCooldown'
		>;
		huntCooldownSeconds?: number;
	}) {
		this.persistence = requirePersistence(options, 'SweepService');
		this.clock = options.clock ?? systemClock;
		this.accounts = options.accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.characters = options.characters ?? new UserCharacterRepository();
		this.monsters = options.monsters ?? new MonsterEncounterService();
		this.rewards = options.rewards ?? new RaidRewardService();
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.events = options.events ?? new EventBus();
		this.queries = options.queries ?? new RaidRepository();
		this.huntCooldownSeconds = options.huntCooldownSeconds ?? RAID_HUNT_COOLDOWN_SECONDS;
	}

	async run(
		discordId: string,
		options: { gate?: number; tier?: number; requestId?: string } = {},
	): Promise<SweepResult> {
		const result = await this.persistence.unitOfWork.run((tx) => this.runSweep(tx, discordId, options));
		if (result.status !== 'ok') return result;
		if (result.credux > 0)
			this.events.emit('currency.earned', { discordId, currency: 'credux', amount: result.credux, source: 'sweep' });
		if (result.progress.leveledUp) this.events.emit('level.up', { discordId, newLevel: result.progress.newLevel });
		return result;
	}

	private async runSweep(
		tx: Transaction,
		discordId: string,
		options: { gate?: number; tier?: number; requestId?: string },
	): Promise<SweepResult> {
		if (options.requestId) {
			const [receipt] = await this.queries.findReceipt(tx, discordId, options.requestId);
			if (receipt) return { status: 'already-processed' };
		}
		await this.queries.lockBag(tx, discordId);
		const now = this.clock.now();
		const [cooldown] = await this.queries.lockHuntCooldown(tx, discordId);
		if (cooldown && cooldown.readyAt > now) return { status: 'cooldown', retryAt: cooldown.readyAt };
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
		const selection = selectGateTier(gatesCleared, account.combatLevel, options.gate, options.tier);
		if ('status' in selection || !selection.tier) {
			return 'status' in selection ? selection : { status: 'portal-locked', message: GATE_TEXT.invalid };
		}
		const gateTier = selection.tier;
		if (gateTier.number > (gatesCleared[gateTier.gate.id - 1] ?? 0)) {
			return {
				status: 'sweep-locked',
				message: SWEEP_TEXT.locked(gateTier.gate.id, (gatesCleared[gateTier.gate.id - 1] ?? 0) + 1),
			};
		}

		const lootRng = createRng(createSecureSeed());
		const monsterStats: MonsterStats | null = await this.monsters.pickForLevel(
			tx,
			gateTier.level,
			lootRng,
			false,
			gateTier.finalBoss,
			gateTier.gate.modifier,
			gateTier.gate.modifier2 ?? 'none',
		);
		if (!monsterStats) return { status: 'no-monsters-seeded' };
		const rolled = rollBattleRewards(lootRng, true, false, monsterStats.mobType, gateTier.level);
		const credux = Math.floor(rolled.credux * SWEEP_RATE);
		const expGained = Math.floor(rolled.expGained * SWEEP_RATE);
		const progress = await this.rewards.grant(tx, discordId, {
			expGain: expGained,
			credux,
			shards: rolled.shards,
			grantChest: false,
			boss: false,
			battleType: 'raid',
			enemyName: monsterStats.name,
			enemyTier: monsterStats.mobType as 'regular' | 'elite' | 'boss',
			outcome: 'player_win',
		});
		await this.progress.apply(tx, discordId, gateTier.finalBoss ? 'final_boss_win' : 'raid_win', now);
		await this.queries.upsertHuntCooldown(tx, discordId, new Date(now.getTime() + this.huntCooldownSeconds * 1000));
		if (options.requestId)
			await this.queries.insertReceipt(tx, { discordId, requestId: options.requestId, kind: 'sweep' });

		return {
			status: 'ok',
			gate: gateTier.gate.id,
			tier: gateTier.number,
			monsterName: raidMonsterName(gateTier, monsterStats),
			credux,
			shards: rolled.shards,
			expGained,
			progress,
		};
	}
}
