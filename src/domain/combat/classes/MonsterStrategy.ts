import { NullClassStrategy } from './NullClassStrategy.js';
import { combatDisplayName, findDebuff } from '../CombatantState.js';
import type { StrategyContext, OutgoingHit, IncomingHit, ResolvedHit } from '../IClassStrategy.js';
import { BOSS_ENTRY } from '../../../config/raidLoot.js';
import {
	COMBAT_MONSTER_ECLIPSE,
	COMBAT_MONSTER_FRENZY,
	COMBAT_MONSTER_FEAST,
	COMBAT_MONSTER_VENOM_SPIT,
} from '../../../text/combat.js';

export class MonsterStrategy extends NullClassStrategy {
	constructor(private readonly skill: string) {
		super();
	}
	override prepareOutgoingHit(ctx: StrategyContext, hit: OutgoingHit): void {
		if (this.skill === 'moon_threshold' && ctx.self.hp < ctx.self.maxHp / 2) {
			hit.damagePctBonus += BOSS_ENTRY.eclipseDamageBonus;
			if (!ctx.self.flags.eclipse) {
				ctx.self.flags.eclipse = true;
				ctx.log(COMBAT_MONSTER_ECLIPSE());
			}
		}
		// Blood frenzy: below 40% HP the beast hits harder (M7 mob variety).
		if (this.skill === 'blood_frenzy' && ctx.self.hp < ctx.self.maxHp * 0.4) {
			hit.damagePctBonus += 0.4;
			if (!ctx.self.flags.frenzy_logged) {
				ctx.self.flags.frenzy_logged = true;
				ctx.log(COMBAT_MONSTER_FRENZY(combatDisplayName(ctx.self)));
			}
		}
	}

	override prepareIncomingHit(_ctx: StrategyContext, hit: IncomingHit): void {
		// Stone hide: a flat chunk of incoming damage never gets through.
		if (this.skill === 'stone_hide') {
			hit.reductionFraction = Math.max(hit.reductionFraction, 0.2);
		}
	}
	override onHitLanded(ctx: StrategyContext, hit: ResolvedHit): void {
		if (this.skill === 'flesh_feast') {
			const healed = Math.floor(hit.damageDealt * 0.1);
			ctx.self.hp = Math.min(ctx.self.maxHp, ctx.self.hp + healed);
			if (healed > 0) ctx.log(COMBAT_MONSTER_FEAST(combatDisplayName(ctx.self), healed.toLocaleString()));
		}
		// Venom spit: wounds fester, ticking true damage for 2 rounds.
		if (this.skill === 'venom_spit' && hit.damageDealt > 0 && ctx.enemy.hp > 0 && !findDebuff(ctx.enemy, 'venom')) {
			const value = Math.max(5, Math.floor(ctx.enemy.maxHp * 0.03));
			ctx.enemy.debuffs.push({ tag: 'venom', turnsLeft: 2, value });
			ctx.log(COMBAT_MONSTER_VENOM_SPIT(combatDisplayName(ctx.self), combatDisplayName(ctx.enemy), value.toLocaleString()));
		}
	}
}
