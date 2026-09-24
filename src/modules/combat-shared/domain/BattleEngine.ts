import { rollChance } from '../../../shared/utils/weightedRandom.js';
import type { CombatantState, Debuff } from './CombatantState.js';
import type { IClassStrategy, StrategyContext } from './IClassStrategy.js';
import { ClassStrategyRegistry } from './ClassStrategyRegistry.js';
import { createRng, createSecureSeed } from './Rng.js';
import { BattleAttackResolver, type IBattleAttackResolver } from './BattleAttack.js';
import { CombatStatusEffectProcessor, type ICombatStatusEffects } from './CombatStatusEffects.js';
import { MAX_ROUNDS, SUDDEN_DEATH_START, suddenDeathMultiplier } from './combatRules.js';
import { COMBAT_ROUND_HEADER, COMBAT_SUDDEN_DEATH_HEADER } from '../../../shared/ui/text/combat.js';

export { SUDDEN_DEATH_START, suddenDeathMultiplier } from './combatRules.js';

export type BattleOutcome = 'player_win' | 'enemy_win' | 'draw';

/** Log lines of one round plus both sides' HP snapshot at the END of that round. */
export interface BattleRoundLog {
	round: number;
	lines: string[];
	playerHp: number;
	playerMaxHp: number;
	enemyHp: number;
	enemyMaxHp: number;
}

export interface BattleResult {
	outcome: BattleOutcome;
	rounds: number;
	log: string[];
	/** Per-round view used by the paginated battle log (Components V2 pager). */
	roundLogs: BattleRoundLog[];
	playerHpRemaining: number;
	enemyHpRemaining: number;
}

/**
 * Context dùng chung xuyên suốt một trận — tránh hàm nào cũng nhận 7-8 tham
 * số lặp lại (player/enemy/strategy/rng/log đi cùng nhau khắp engine).
 */
interface RoundContext {
	player: CombatantState;
	enemy: CombatantState;
	playerStrategy: IClassStrategy;
	enemyStrategy: IClassStrategy;
	rng: () => number;
	log: string[];
	/** Debuffs present before turns; newly applied statuses start counting next round. */
	existingDebuffs: Set<Debuff>;
}

/**
 * Core turn-based combat loop, ported (in reduced scope — see class-level
 * docs on each Strategy) from engine/battleEngine.js's resolveBattle.
 *
 * Deliberately out of scope for this milestone (left for later, item/
 * content-system dependent): weapon/armor passives, additional bosses and
 * PvP/duel/ranked-specific rules. Rune effects, deity blessings (via the
 * DeityBlessingDecorator) and Bakunawa/elite passives use the same strategy
 * hooks; sudden death (rounds 31–40, damage doubling each round) and the
 * initiative roll (Tailwind bias flag) are part of the core loop.
 */
export class BattleEngine {
	constructor(
		private readonly attacks: IBattleAttackResolver = new BattleAttackResolver(),
		private readonly statuses: ICombatStatusEffects = new CombatStatusEffectProcessor(),
	) {}

	resolve(
		player: CombatantState,
		enemy: CombatantState,
		seed: number | undefined = undefined,
		overrides?: { playerStrategy?: IClassStrategy; enemyStrategy?: IClassStrategy },
	): BattleResult {
		// Unpredictable by default (crypto seed); deterministic replays pass
		// an explicit seed instead of relying on wall-clock milliseconds.
		const rng = createRng(seed ?? createSecureSeed());
		const roundLogs: BattleRoundLog[] = [];
		const playerStrategy = overrides?.playerStrategy ?? ClassStrategyRegistry.forClass(player.combatClass);
		const enemyStrategy = overrides?.enemyStrategy ?? ClassStrategyRegistry.forClass(enemy.combatClass);
		const ctx: RoundContext = {
			player,
			enemy,
			playerStrategy,
			enemyStrategy,
			rng,
			log: [],
			existingDebuffs: new Set(),
		};

		let round = 1;
		for (; round <= MAX_ROUNDS; round++) {
			if (player.hp <= 0 || enemy.hp <= 0) break;
			ctx.log = [];
			this.playRound(ctx, round);
			roundLogs.push({
				round,
				lines: ctx.log,
				playerHp: player.hp,
				playerMaxHp: player.maxHp,
				enemyHp: enemy.hp,
				enemyMaxHp: enemy.maxHp,
			});
		}

		return {
			outcome: this.resolveOutcome(player, enemy),
			rounds: roundLogs.length,
			log: roundLogs.flatMap((r) => r.lines),
			roundLogs,
			playerHpRemaining: player.hp,
			enemyHpRemaining: enemy.hp,
		};
	}

	private playRound(ctx: RoundContext, round: number): void {
		const { player, enemy, playerStrategy, enemyStrategy, rng, log } = ctx;
		log.push(COMBAT_ROUND_HEADER(round));
		if (round === SUDDEN_DEATH_START + 1) log.push(COMBAT_SUDDEN_DEATH_HEADER(suddenDeathMultiplier(round)));

		playerStrategy.onRoundStart({ self: player, enemy: enemy, round, rng, log: (m) => log.push(m) });
		enemyStrategy.onRoundStart({ self: enemy, enemy: player, round, rng, log: (m) => log.push(m) });

		// Debuffs pushed during the turns must not tick down at this round's
		// end — a 1-turn debuff would otherwise expire before ever taking
		// effect on the holder's next turn.
		ctx.existingDebuffs = new Set<Debuff>([...player.debuffs, ...enemy.debuffs]);

		for (const [attacker, defender, atkStrategy, defStrategy] of this.turnOrder(ctx)) {
			if (player.hp <= 0 || enemy.hp <= 0) break;
			this.takeTurn(attacker, defender, atkStrategy, defStrategy, round, ctx);
		}

		this.closeRound(ctx, round);
	}

	/** End-of-round bookkeeping, skipped entirely once either side has fallen. */
	private closeRound(ctx: RoundContext, round: number): void {
		const { player, enemy } = ctx;
		if (player.hp <= 0 || enemy.hp <= 0) return;
		this.endOfRound(player, enemy, ctx.playerStrategy, round, ctx);
		if (player.hp <= 0) return;
		this.endOfRound(enemy, player, ctx.enemyStrategy, round, ctx);
	}

	/** Initiative: the holder of a higher `initiative_bias` flag (Tailwind blessing) is more likely to act first; even footing is 50/50. */
	private turnOrder(ctx: RoundContext): Array<[CombatantState, CombatantState, IClassStrategy, IClassStrategy]> {
		const { player, enemy, playerStrategy, enemyStrategy, rng } = ctx;
		const playerBias = (player.flags.initiative_bias as number) ?? 0;
		const enemyBias = (enemy.flags.initiative_bias as number) ?? 0;
		const playerFirst = rollChance(0.5 + playerBias - enemyBias, rng);
		const playerTurn: [CombatantState, CombatantState, IClassStrategy, IClassStrategy] = [
			player,
			enemy,
			playerStrategy,
			enemyStrategy,
		];
		const enemyTurn: [CombatantState, CombatantState, IClassStrategy, IClassStrategy] = [
			enemy,
			player,
			enemyStrategy,
			playerStrategy,
		];
		return playerFirst ? [playerTurn, enemyTurn] : [enemyTurn, playerTurn];
	}

	private resolveOutcome(player: CombatantState, enemy: CombatantState): BattleOutcome {
		if (player.hp <= 0 && enemy.hp <= 0) return 'draw';
		if (enemy.hp <= 0) return 'player_win';
		if (player.hp <= 0) return 'enemy_win';
		// Round-limit reached with both alive: equal HP% is a draw.
		const playerHpRatio = player.hp / player.maxHp;
		const enemyHpRatio = enemy.hp / enemy.maxHp;
		if (playerHpRatio === enemyHpRatio) return 'draw';
		return playerHpRatio > enemyHpRatio ? 'player_win' : 'enemy_win';
	}

	private takeTurn(
		attacker: CombatantState,
		defender: CombatantState,
		atkStrategy: IClassStrategy,
		defStrategy: IClassStrategy,
		round: number,
		battle: RoundContext,
	): void {
		const ctx: StrategyContext = {
			self: attacker,
			enemy: defender,
			round,
			rng: battle.rng,
			log: (m) => battle.log.push(m),
		};
		this.statuses.removeImmuneDebuffs(attacker);
		if (this.statuses.isTurnDisabled(attacker, battle.rng, battle.log)) return;
		this.attacks.executeStrike(attacker, defender, atkStrategy, defStrategy, ctx);
	}

	private endOfRound(
		side: CombatantState,
		opponent: CombatantState,
		strategy: IClassStrategy,
		round: number,
		battle: RoundContext,
	): void {
		if (side.hp <= 0) return;
		const ctx: StrategyContext = {
			self: side,
			enemy: opponent,
			round,
			rng: battle.rng,
			log: (m) => battle.log.push(m),
		};
		this.statuses.applyEndOfRoundEffects(side, battle.existingDebuffs, battle.log);

		if (side.hp > 0) strategy.onRoundEnd(ctx);
	}
}
