import { db } from '../db/client.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { MonsterRepository } from '../repositories/MonsterRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { RaidRewardRepository, type RaidRewardResult } from '../repositories/RaidRewardRepository.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { createCombatant } from '../domain/combat/CombatantState.js';
import { BattleEngine, type BattleResult } from '../domain/combat/BattleEngine.js';
import { ClassStrategyRegistry } from '../domain/combat/ClassStrategyRegistry.js';
import { wrapWithRunes } from '../domain/combat/RuneStrategyDecorator.js';
import { scaleExpForMobLevel } from '../config/expScaling.js';
import { RAID_LOOT_REGULAR, randInt, rollRaidChest } from '../config/raidLoot.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';

export type RaidResult =
	| { status: 'not-registered' }
	| { status: 'no-character' }
	| { status: 'no-monsters-seeded' }
	| {
			status: 'ok';
			battle: BattleResult;
			monsterName: string;
			credux: number;
			shards: number;
			expGained: number;
			gotChest: boolean;
			progress: RaidRewardResult;
	  };

/**
 * Facade for `/raid`. Two phases:
 *  1. Read-only setup (account, StatAssemblyService's full gear+deity+rune
 *     stat build, monster) and the battle simulation — no DB writes.
 *  2. Reward granting — wrapped in `db.transaction()` for atomicity.
 *
 * Combat stats now come from StatAssemblyService (class + weapon/armor +
 * active deity + rune stat-%, see its own doc comment for exactly what's
 * still simplified vs the original statAssembly.js).
 */
export class RaidService {
	constructor(
		private readonly accounts = new PlayerAccountRepository(),
		private readonly monsters = new MonsterRepository(),
		private readonly characters = new UserCharacterRepository(),
		private readonly rewards = new RaidRewardRepository(),
		private readonly statAssembly = new StatAssemblyService(),
		private readonly events = EventBus.getInstance(),
	) {}

	async run(discordId: string): Promise<RaidResult> {
		const account = await this.accounts.findById(discordId);
		if (!account) return { status: 'not-registered' };
		if (!this.characters.hasCharacter(db, discordId)) return { status: 'no-character' };

		const monsterStats = this.monsters.pickRandomRegularForLevel(db, account.combatLevel);
		if (!monsterStats) return { status: 'no-monsters-seeded' };

		const assembled = this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel);
		const player = createCombatant({
			name: account.username,
			combatClass: account.combatClass,
			hp: assembled.stats.hp,
			atk: assembled.stats.atk,
			def: assembled.stats.def,
			crit: assembled.stats.crit,
		});

		const baseStrategy = ClassStrategyRegistry.forClass(account.combatClass);
		const playerStrategy = wrapWithRunes(baseStrategy, assembled.combatEffectRunes);

		const monster = createCombatant({
			name: monsterStats.name,
			combatClass: null,
			hp: monsterStats.hp,
			atk: monsterStats.atk,
			def: monsterStats.def,
			crit: monsterStats.crit,
		});

		const battle = new BattleEngine().resolve(player, monster, Date.now(), { playerStrategy });
		const won = battle.outcome === 'player_win';

		const lootRng = createRng(createSecureSeed());
		let credux = 0;
		let shards = 0;
		let baseExp: number;
		let gotChest = false;

		if (won) {
			credux = randInt(lootRng, RAID_LOOT_REGULAR.win.creduxRange);
			baseExp = randInt(lootRng, RAID_LOOT_REGULAR.win.expRange);
			shards = randInt(lootRng, RAID_LOOT_REGULAR.win.shardsRange);
			gotChest = rollRaidChest(lootRng, RAID_LOOT_REGULAR.win.chestChance);
		} else {
			baseExp = RAID_LOOT_REGULAR.loss.exp;
		}
		const expGained = scaleExpForMobLevel(baseExp, account.combatLevel);

		const progress = db.transaction((tx) =>
			this.rewards.grant(tx, discordId, { expGain: expGained, credux, shards, grantChest: gotChest }),
		);

		this.events.emit(won ? 'battle.won' : 'battle.lost', { discordId, battleType: 'raid' });
		if (credux > 0)
			this.events.emit('currency.earned', { discordId, currency: 'credux', amount: credux, source: 'raid' });
		if (progress.leveledUp) this.events.emit('level.up', { discordId, newLevel: progress.newLevel });

		return { status: 'ok', battle, monsterName: monsterStats.name, credux, shards, expGained, gotChest, progress };
	}
}
