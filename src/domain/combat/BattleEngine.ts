import type { CombatantState, Debuff } from './CombatantState.js';
import { findDebuff } from './CombatantState.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import { ClassStrategyRegistry } from './ClassStrategyRegistry.js';
import { mitigate, rollVariance, rollCrit, hitMultiplier } from './DamageCalculator.js';
import { createRng } from './Rng.js';

export type BattleOutcome = 'player_win' | 'enemy_win' | 'draw';

export interface BattleResult {
	outcome: BattleOutcome;
	rounds: number;
	log: string[];
	playerHpRemaining: number;
	enemyHpRemaining: number;
}

const MAX_ROUNDS = 30;

/**
 * Core turn-based combat loop, ported (in reduced scope — see class-level
 * docs on each Strategy) from engine/battleEngine.js's resolveBattle.
 *
 * Deliberately out of scope for this milestone (left for later, item/
 * content-system dependent): weapon/armor/deity passives, rune effects,
 * boss-specific mechanics (phase transitions, threshold buffs), sudden
 * death past round 30, PvP/duel/ranked-specific rules. Those all layer
 * on top of this same class-strategy pipeline once ported.
 */
export class BattleEngine {
	resolve(
		player: CombatantState,
		enemy: CombatantState,
		seed: number = Date.now(),
		overrides?: { playerStrategy?: IClassStrategy; enemyStrategy?: IClassStrategy },
	): BattleResult {
		const rng = createRng(seed);
		const log: string[] = [];
		const playerStrategy = overrides?.playerStrategy ?? ClassStrategyRegistry.forClass(player.combatClass);
		const enemyStrategy = overrides?.enemyStrategy ?? ClassStrategyRegistry.forClass(enemy.combatClass);

		let round = 1;
		for (; round <= MAX_ROUNDS; round++) {
			if (player.hp <= 0 || enemy.hp <= 0) break;
			log.push(`— Round ${round} —`);

			playerStrategy.onRoundStart({ self: player, enemy: enemy, round, rng, log: (m) => log.push(m) });
			enemyStrategy.onRoundStart({ self: enemy, enemy: player, round, rng, log: (m) => log.push(m) });

			// Debuffs pushed during THIS round must not tick down at this round's
			// end — a 1-turn debuff would otherwise expire before ever taking
			// effect on the holder's next turn.
			const freshDebuffs = new Set<Debuff>([...player.debuffs, ...enemy.debuffs]);

			const turns: Array<[CombatantState, CombatantState, IClassStrategy, IClassStrategy]> = [
				[player, enemy, playerStrategy, enemyStrategy],
				[enemy, player, enemyStrategy, playerStrategy],
			];
			for (const [attacker, defender, atkStrategy, defStrategy] of turns) {
				if (player.hp <= 0 || enemy.hp <= 0) break;
				this.takeTurn(attacker, defender, atkStrategy, defStrategy, round, rng, log);
			}

			if (player.hp <= 0 || enemy.hp <= 0) break;

			this.endOfRound(player, playerStrategy, round, rng, log, freshDebuffs);
			if (player.hp <= 0) break;
			this.endOfRound(enemy, enemyStrategy, round, rng, log, freshDebuffs);
		}

		const outcome: BattleOutcome =
			player.hp <= 0 && enemy.hp <= 0
				? 'draw'
				: enemy.hp <= 0
					? 'player_win'
					: player.hp <= 0
						? 'enemy_win'
						: // Round-limit reached with both alive: whoever has the higher HP% wins.
							player.hp / player.maxHp >= enemy.hp / enemy.maxHp
							? 'player_win'
							: 'enemy_win';

		return {
			outcome,
			rounds: Math.min(round, MAX_ROUNDS),
			log,
			playerHpRemaining: player.hp,
			enemyHpRemaining: enemy.hp,
		};
	}

	private takeTurn(
		attacker: CombatantState,
		defender: CombatantState,
		atkStrategy: IClassStrategy,
		defStrategy: IClassStrategy,
		round: number,
		rng: () => number,
		log: string[],
	): void {
		const ctx: StrategyContext = { self: attacker, enemy: defender, round, rng, log: (m) => log.push(m) };

		// Hard crowd-control: skip the action entirely.
		if (findDebuff(attacker, 'stun') || findDebuff(attacker, 'paralyze')) {
			log.push(`${attacker.name} is unable to act this turn.`);
			return;
		}

		// Dizzy: single-use miss chance on the next attack, consumed either way.
		const dizzy = findDebuff(attacker, 'dizzy');
		if (dizzy) {
			attacker.debuffs = attacker.debuffs.filter((d) => d !== dizzy);
			if (rng() < dizzy.value) {
				log.push(`${attacker.name}'s attack misses (Dizzy)!`);
				return;
			}
		}

		const resolved = this.performAttack(attacker, defender, atkStrategy, defStrategy, ctx);

		if (resolved.triggerExtraAttack && defender.hp > 0) {
			this.performAttack(attacker, defender, atkStrategy, defStrategy, ctx);
		}
	}

	private performAttack(
		attacker: CombatantState,
		defender: CombatantState,
		atkStrategy: IClassStrategy,
		defStrategy: IClassStrategy,
		ctx: StrategyContext,
	): ResolvedHit {
		const hit: OutgoingHit = {
			damagePctBonus: 0,
			armorPierceFraction: 0,
			forcedMultiplier: null,
			suppressCrit: false,
		};
		atkStrategy.prepareOutgoingHit(ctx, hit);

		const incoming: IncomingHit = { reductionFraction: 0 };
		const defCtx: StrategyContext = {
			self: defender,
			enemy: attacker,
			round: ctx.round,
			rng: ctx.rng,
			log: ctx.log,
		};
		defStrategy.prepareIncomingHit(defCtx, incoming);

		const atkDownPct = findDebuff(attacker, 'atk_down')?.value ?? 0;
		const defDownPct = findDebuff(defender, 'def_down')?.value ?? 0;

		const effAtk = attacker.atk * (1 - atkDownPct);
		const effDef = defender.def * (1 - defDownPct) * (1 - hit.armorPierceFraction);

		const variance = rollVariance(ctx.rng);
		const crit = !hit.suppressCrit && rollCrit(ctx.rng, attacker.crit);

		let amount: number;
		if (hit.forcedMultiplier != null) {
			amount = mitigate(effAtk, effDef) * variance * hit.forcedMultiplier;
		} else {
			amount = mitigate(effAtk, effDef) * variance * hitMultiplier(crit, hit.damagePctBonus);
		}
		amount *= 1 - incoming.reductionFraction;

		const dealt = Math.max(0, Math.floor(amount));
		defender.hp = Math.max(0, defender.hp - dealt);

		ctx.log(
			`${attacker.name} hits ${defender.name} for ${dealt.toLocaleString()}${crit ? ' (CRIT)' : ''} damage.` +
				(defender.hp <= 0 ? ` ${defender.name} is defeated!` : ''),
		);

		const resolved: ResolvedHit = { damageDealt: dealt, crit, triggerExtraAttack: false };
		atkStrategy.onHitLanded(ctx, resolved);

		if (defender.hp > 0) {
			const defTakenCtx: StrategyContext = {
				self: defender,
				enemy: attacker,
				round: ctx.round,
				rng: ctx.rng,
				log: ctx.log,
			};
			defStrategy.onDamageTaken(defTakenCtx, resolved);
		}
		return resolved;
	}

	private endOfRound(
		side: CombatantState,
		strategy: IClassStrategy,
		round: number,
		rng: () => number,
		log: string[],
		freshDebuffs: Set<Debuff>,
	): void {
		if (side.hp <= 0) return;
		const ctx: StrategyContext = { self: side, enemy: side, round, rng, log: (m) => log.push(m) };

		// DOT ticks (bleed, burn, venom), reduced by the target's Warding rune (if any).
		const wardingPct = (side.flags.warding_pct as number) ?? 0;
		for (const debuff of side.debuffs) {
			if (debuff.tag !== 'bleed' && debuff.tag !== 'burn' && debuff.tag !== 'venom') continue;
			const tick = Math.floor(debuff.value * (1 - wardingPct));
			if (tick > 0) {
				side.hp = Math.max(0, side.hp - tick);
				log.push(`${side.name} suffers ${tick.toLocaleString()} ${debuff.tag} damage.`);
			}
			debuff.turnsLeft -= 1;
		}
		// Non-DOT status durations tick down too (stun/paralyze/atk_down/def_down/blight),
		// except ones applied this same round — those start counting next round.
		for (const debuff of side.debuffs) {
			if (debuff.tag === 'bleed' || debuff.tag === 'burn' || debuff.tag === 'venom') continue;
			if (freshDebuffs.has(debuff)) continue;
			debuff.turnsLeft -= 1;
		}
		side.debuffs = side.debuffs.filter((d) => d.turnsLeft > 0);

		if (side.hp > 0) strategy.onRoundEnd(ctx);
	}
}
