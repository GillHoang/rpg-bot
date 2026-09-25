import { formatNumber } from '../../../../shared/ui/text/format.js';
import { rollChance } from '../../../../shared/utils/weightedRandom.js';
import { NullClassStrategy } from './NullClassStrategy.js';
import { applyDebuff, cappedHeal, combatDisplayName, findDebuff } from '../CombatantState.js';
import type { StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from '../IClassStrategy.js';
import { BOSS_ENTRY } from '../../../../shared/config/raidLoot.js';
import {
	COMBAT_MONSTER_DEVOUR,
	COMBAT_MONSTER_DEVOUR_CHARGE,
	COMBAT_MONSTER_ECLIPSE,
	COMBAT_MONSTER_FEAST,
	COMBAT_MONSTER_FRENZY,
	COMBAT_MONSTER_HAZE,
	COMBAT_MONSTER_LEAP,
	COMBAT_MONSTER_PHASE_THREE,
	COMBAT_MONSTER_PHASE_TWO,
	COMBAT_MONSTER_REGEN,
	COMBAT_MONSTER_SHED,
	COMBAT_MONSTER_CLIPPERS,
	COMBAT_MONSTER_SMOKE,
	COMBAT_MONSTER_SWIFT,
	COMBAT_MONSTER_VENOM_SPIT,
} from '../../../../shared/ui/text/combat.js';

export interface MonsterTraits {
	/** Elite affixes rolled at encounter time (see MonsterEncounterService). */
	affixes?: string[];
}

/**
 * P4 monster AI: HP-threshold phases, telegraphed heavies and a round
 * rotation counter instead of flat per-hit procs. Bakunawa runs three
 * phases (P1 lunar scales → P2 eclipse → P3 enrage + devour cycle) with
 * DOT-shed on every transition. Regular/elite signature skills from the
 * roster now all have real logic; modifier-gate variety comes from affixes
 * plus the regen_pct flag (gate modifier `regen`).
 */
export class MonsterStrategy extends NullClassStrategy {
	constructor(
		private readonly skill: string,
		private readonly traits: MonsterTraits = {},
	) {
		super();
	}

	private affixes(ctx: StrategyContext): string[] {
		if (!ctx.self.flags.monsterAffixes) {
			ctx.self.flags.monsterAffixes = true;
			return this.traits.affixes ?? [];
		}
		return [];
	}

	override onRoundStart(ctx: StrategyContext): void {
		const flags = ctx.self.flags;
		flags.monsterRounds = flags.monsterRounds + 1;

		// One-time affix setup: swift initiative, tenacious resolve.
		for (const affix of this.affixes(ctx)) {
			if (affix === 'swift') {
				flags.initiativeBias = flags.initiativeBias + 0.15;
				ctx.log(COMBAT_MONSTER_SWIFT(combatDisplayName(ctx.self)));
			} else if (affix === 'tenacious') {
				ctx.self.ten = Math.max(ctx.self.ten, 50);
			}
		}

		// Gate-modifier regen: slow mend every round.
		const regenPct = flags.regenPct;
		if (regenPct > 0 && ctx.self.hp > 0 && ctx.self.hp < ctx.self.maxHp) {
			const healed = Math.min(ctx.self.maxHp - ctx.self.hp, Math.floor(ctx.self.maxHp * regenPct));
			if (healed > 0) {
				ctx.self.hp += healed;
				ctx.log(COMBAT_MONSTER_REGEN(combatDisplayName(ctx.self), formatNumber(healed)));
			}
		}

		// Bakunawa phase tracking + telegraphs.
		if (this.skill === 'moon_threshold') {
			this.trackBakunawaPhase(ctx);
			// Devour telegraph: charged on the round before, consumed on the strike.
			if (
				ctx.self.hp < ctx.self.maxHp / 3 &&
				ctx.self.flags.monsterRounds % 4 === 3 &&
				!ctx.self.flags.devourCharging
			) {
				ctx.self.flags.devourCharging = true;
				ctx.log(COMBAT_MONSTER_DEVOUR_CHARGE(combatDisplayName(ctx.self)));
			}
		}
		if (this.skill === 'blood_moon_leap' && flags.monsterRounds % 3 === 0) {
			flags.leapCharging = true;
			ctx.log(COMBAT_MONSTER_DEVOUR_CHARGE(combatDisplayName(ctx.self)));
		}
	}

	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		const hpFrac = ctx.self.hp / ctx.self.maxHp;

		this.applyMoonThreshold(ctx, hit, hpFrac);
		this.applyBloodFrenzy(ctx, hit, hpFrac);
		// Frenzy echo (affix): a weaker, earlier frenzy below half HP.
		if ((this.traits.affixes ?? []).includes('frenzy_echo') && hpFrac < 0.5) {
			hit.damagePctBonus += 25;
		}
		// Blood-moon leap: charged heavy, consumed on the strike.
		if (this.skill === 'blood_moon_leap' && ctx.self.flags.leapCharging) {
			ctx.self.flags.leapCharging = false;
			hit.forcedMultiplier = Math.max(hit.forcedMultiplier ?? 0, 2.0);
			ctx.log(COMBAT_MONSTER_LEAP(combatDisplayName(ctx.self)));
		}
	}

	/** Bakunawa phase damage bonuses + telegraphed Devour strike. */
	private applyMoonThreshold(ctx: StrategyContext, hit: OutgoingHit, hpFrac: number): void {
		if (this.skill !== 'moon_threshold') return;
		// Phase bonuses; announcements + DOT-shed live in trackBakunawaPhase.
		if (hpFrac < 1 / 3) {
			// P3 enrage replaces the eclipse bonus once crossed.
			hit.damagePctBonus += 80;
		} else if (hpFrac < 1 / 2) {
			hit.damagePctBonus += BOSS_ENTRY.eclipseDamageBonus;
		} else if (hpFrac < 2 / 3) {
			hit.damagePctBonus += 20;
		}
		// Devour: consumed on the strike after the telegraphed charge round.
		if (hpFrac < 1 / 3 && ctx.self.flags.devourCharging) {
			ctx.self.flags.devourCharging = false;
			hit.forcedMultiplier = Math.max(hit.forcedMultiplier ?? 0, 3.0);
			ctx.log(COMBAT_MONSTER_DEVOUR(combatDisplayName(ctx.self)));
		}
	}

	/** Blood frenzy: below 40% HP the beast hits harder (M7 mob variety). */
	private applyBloodFrenzy(ctx: StrategyContext, hit: OutgoingHit, hpFrac: number): void {
		if (this.skill !== 'blood_frenzy' || hpFrac >= 0.4) return;
		hit.damagePctBonus += 40;
		if (!ctx.self.flags.frenzyLogged) {
			ctx.self.flags.frenzyLogged = true;
			ctx.log(COMBAT_MONSTER_FRENZY(combatDisplayName(ctx.self)));
		}
	}

	override prepareIncomingHit(ctx: StrategyContext, hit: IncomingHit): void {
		// Stone hide: a flat chunk of incoming damage never gets through.
		if (this.skill === 'stone_hide') {
			hit.reductionFraction = Math.max(hit.reductionFraction, 0.2);
		}
		if ((this.traits.affixes ?? []).includes('stone_skin')) {
			hit.reductionFraction = Math.max(hit.reductionFraction, 0.15);
		}
		// P1 lunar scales: Bakunawa shrugs off a slice while healthy.
		if (this.skill === 'moon_threshold' && ctx.self.hp >= (ctx.self.maxHp * 2) / 3) {
			hit.reductionFraction = Math.max(hit.reductionFraction, 0.12);
		}
	}

	override onHitLanded(ctx: StrategyContext, hit: ResolvedHit): void {
		if (hit.damageDealt <= 0) return;
		if (this.skill === 'flesh_feast') {
			const healed = Math.floor(hit.damageDealt * 0.1);
			this.healSelf(ctx, healed, (name, amount) => COMBAT_MONSTER_FEAST(name, amount));
		}
		if ((this.traits.affixes ?? []).includes('vampiric')) {
			const healed = Math.floor(hit.damageDealt * 0.05);
			this.healSelf(ctx, healed, (name, amount) => COMBAT_MONSTER_FEAST(name, amount));
		}
		// Venom spit: wounds fester, ticking true damage for 2 rounds.
		if (this.skill === 'venom_spit' && ctx.enemy.hp > 0 && !findDebuff(ctx.enemy, 'venom')) {
			const value = Math.max(5, Math.floor(ctx.enemy.maxHp * 0.03));
			applyDebuff(ctx.enemy, { tag: 'venom', turnsLeft: 2, value }, ctx.rng, ctx.log);
			ctx.log(
				COMBAT_MONSTER_VENOM_SPIT(
					combatDisplayName(ctx.self),
					combatDisplayName(ctx.enemy),
					formatNumber(value),
				),
			);
		}
		// Wing clippers: tear at the enemy's arms — attack down.
		if (this.skill === 'wing_clippers') {
			applyDebuff(ctx.enemy, { tag: 'atk_down', turnsLeft: 2, value: 0.15 }, ctx.rng, ctx.log);
			ctx.log(COMBAT_MONSTER_CLIPPERS(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
		}
		// Trail haze: a confusing mist hangs on the strike.
		if (this.skill === 'trail_haze' && rollChance(0.5, ctx.rng)) {
			applyDebuff(ctx.enemy, { tag: 'dizzy', turnsLeft: 1, value: 0.2 }, ctx.rng, ctx.log);
			ctx.log(COMBAT_MONSTER_HAZE(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
		}
		// Cigar smoke: choking soot blights recovery.
		if (this.skill === 'cigar_smoke') {
			const existing = findDebuff(ctx.enemy, 'blight');
			if (existing) {
				existing.value = Math.max(existing.value, 0.1);
				existing.turnsLeft = 1;
			} else {
				applyDebuff(ctx.enemy, { tag: 'blight', turnsLeft: 1, value: 0.1 }, ctx.rng, ctx.log);
			}
			ctx.log(COMBAT_MONSTER_SMOKE(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy)));
		}
	}

	/** Bakunawa phase transitions shed DOTs and announce themselves once each. */
	private trackBakunawaPhase(ctx: StrategyContext): void {
		const hpFrac = ctx.self.hp / ctx.self.maxHp;
		const phase = bakunawaPhase(hpFrac);
		const previous = ctx.self.flags.bakuPhase;
		if (phase === previous) return;
		const crossedTwo = previous < 2 && phase >= 2;
		const crossedThree = previous < 3 && phase >= 3;
		ctx.self.flags.bakuPhase = phase;
		// Shed damage-over-time on every transition.
		const before = ctx.self.debuffs.length;
		ctx.self.debuffs = ctx.self.debuffs.filter((d) => d.tag !== 'bleed' && d.tag !== 'burn' && d.tag !== 'venom');
		const shed = before !== ctx.self.debuffs.length;
		if (crossedTwo) {
			ctx.log(COMBAT_MONSTER_PHASE_TWO(combatDisplayName(ctx.self)));
			ctx.log(COMBAT_MONSTER_ECLIPSE());
			if (shed) ctx.log(COMBAT_MONSTER_SHED(combatDisplayName(ctx.self)));
		}
		if (crossedThree) {
			ctx.log(COMBAT_MONSTER_PHASE_THREE(combatDisplayName(ctx.self)));
			if (shed) ctx.log(COMBAT_MONSTER_SHED(combatDisplayName(ctx.self)));
		}
	}

	private healSelf(ctx: StrategyContext, healed: number, text: (name: string, amount: string) => string): void {
		const granted = cappedHeal(ctx.self, healed);
		if (granted <= 0) return;
		ctx.log(text(combatDisplayName(ctx.self), formatNumber(granted)));
	}
}

/** Bakunawa phase from remaining HP fraction: P3 below a third, P2 below half, else P1. */
function bakunawaPhase(hpFrac: number): number {
	if (hpFrac < 1 / 3) return 3;
	if (hpFrac < 1 / 2) return 2;
	return 1;
}
