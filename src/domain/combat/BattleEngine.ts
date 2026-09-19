import { rollChance } from '../../utils/weightedRandom.js';
import type { CombatantState, Debuff } from './CombatantState.js';
import { findDebuff } from './CombatantState.js';
import type { IClassStrategy, StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from './IClassStrategy.js';
import { ClassStrategyRegistry } from './ClassStrategyRegistry.js';
import { mitigate, rollVariance, rollCrit, hitMultiplier } from './DamageCalculator.js';
import { createRng } from './Rng.js';
import {
	COMBAT_ATTACK_MISSES_DIZZY,
	COMBAT_CRIT_SUFFIX,
	COMBAT_DEFEATED_SUFFIX,
	COMBAT_DOT_TICK,
	COMBAT_HIT,
	COMBAT_ROUND_HEADER,
	COMBAT_SUDDEN_DEATH_HEADER,
	COMBAT_UNABLE_TO_ACT,
} from '../../text/combat.js';

export type BattleOutcome = 'player_win' | 'enemy_win' | 'draw';

export interface BattleResult {
	outcome: BattleOutcome;
	rounds: number;
	log: string[];
	playerHpRemaining: number;
	enemyHpRemaining: number;
}

/** Rounds 1–30 are normal; 31–40 sudden death: all damage × 2^(round−30). */
export const SUDDEN_DEATH_START = 30;
const MAX_ROUNDS = 40;

/** Damage amplifier once sudden death kicks in (round ≤ 30 → ×1). */
export function suddenDeathMultiplier(round: number): number {
	if (round <= SUDDEN_DEATH_START) return 1;
	return 2 ** (round - SUDDEN_DEATH_START);
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
			log.push(COMBAT_ROUND_HEADER(round));
			if (round === SUDDEN_DEATH_START + 1) log.push(COMBAT_SUDDEN_DEATH_HEADER(suddenDeathMultiplier(round)));

			playerStrategy.onRoundStart({ self: player, enemy: enemy, round, rng, log: (m) => log.push(m) });
			enemyStrategy.onRoundStart({ self: enemy, enemy: player, round, rng, log: (m) => log.push(m) });

			// Initiative: the holder of a higher `initiative_bias` flag (Tailwind
			// blessing) is more likely to act first this round; even footing is 50/50.
			const playerBias = (player.flags.initiative_bias as number) ?? 0;
			const enemyBias = (enemy.flags.initiative_bias as number) ?? 0;
			const playerFirst = rollChance(0.5 + playerBias - enemyBias, rng);

			// Debuffs pushed during THIS round must not tick down at this round's
			// end — a 1-turn debuff would otherwise expire before ever taking
			// effect on the holder's next turn.
			const freshDebuffs = new Set<Debuff>([...player.debuffs, ...enemy.debuffs]);

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
			const turns = playerFirst ? [playerTurn, enemyTurn] : [enemyTurn, playerTurn];
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
		const immunities = attacker.immunityTags;
		if (immunities)
			attacker.debuffs = attacker.debuffs.filter(
				(d) => !immunities.includes(d.tag) && !(d.tag === 'venom' && immunities.includes('poison')),
			);

		// Hard crowd-control: skip the action entirely.
		if (findDebuff(attacker, 'stun') || findDebuff(attacker, 'paralyze')) {
			log.push(COMBAT_UNABLE_TO_ACT(attacker.name));
			return;
		}

		// Dizzy: single-use miss chance on the next attack, consumed either way.
		const dizzy = findDebuff(attacker, 'dizzy');
		if (dizzy) {
			attacker.debuffs = attacker.debuffs.filter((d) => d !== dizzy);
			if (rollChance(dizzy.value, rng)) {
				log.push(COMBAT_ATTACK_MISSES_DIZZY(attacker.name));
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

		const atkDownPct = Math.min(
			1,
			(findDebuff(attacker, 'atk_down')?.value ?? 0) + (findDebuff(attacker, 'blight')?.value ?? 0),
		);
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
		amount *= suddenDeathMultiplier(ctx.round);

		const dealt = Math.max(0, Math.floor(amount));
		defender.hp = Math.max(0, defender.hp - dealt);

		ctx.log(
			COMBAT_HIT(
				attacker.name,
				defender.name,
				dealt.toLocaleString(),
				crit ? COMBAT_CRIT_SUFFIX : '',
				defender.hp <= 0 ? COMBAT_DEFEATED_SUFFIX(defender.name) : '',
			),
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
		const immunities = side.immunityTags;
		if (immunities)
			side.debuffs = side.debuffs.filter(
				(d) => !immunities.includes(d.tag) && !(d.tag === 'venom' && immunities.includes('poison')),
			);

		// DOT ticks (bleed, burn, venom), reduced by the target's Warding rune (if any).
		const wardingPct = (side.flags.warding_pct as number) ?? 0;
		for (const debuff of side.debuffs) {
			if (debuff.tag !== 'bleed' && debuff.tag !== 'burn' && debuff.tag !== 'venom') continue;
			const tick = Math.floor(debuff.value * (1 - wardingPct));
			if (tick > 0) {
				side.hp = Math.max(0, side.hp - tick);
				log.push(COMBAT_DOT_TICK(side.name, tick.toLocaleString(), debuff.tag));
			}
			debuff.turnsLeft -= 1;
		}
		// Non-DOT status durations tick down too (stun/paralyze/atk_down/def_down/blight),
		// except ones applied this same round — those start counting next round.
		for (const debuff of side.debuffs) {
			if (debuff.tag === 'bleed' || debuff.tag === 'burn' || debuff.tag === 'venom') continue;
			if (!freshDebuffs.has(debuff)) continue;
			debuff.turnsLeft -= 1;
		}
		side.debuffs = side.debuffs.filter((d) => d.turnsLeft > 0);

		if (side.hp > 0) strategy.onRoundEnd(ctx);
	}
}
