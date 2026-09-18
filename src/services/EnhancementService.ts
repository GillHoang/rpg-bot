import { db } from '../db/client.js';
import { EnhancementRepository } from '../repositories/EnhancementRepository.js';
import { nextAttempt, computeWeaponCurrAtk, computeArmorCurrStats } from '../config/enhancement.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';

export type EnhanceResult =
	| { status: 'not-found' }
	| { status: 'maxed-or-not-enhanceable' }
	| { status: 'insufficient-credux'; needed: number; have: number }
	| { status: 'success'; newLevel: number; cost: number }
	| { status: 'failure'; cost: number };

/**
 * Facade for `/enhance`. Ported from engine/enhancement.js's pure math +
 * commands/rpg/enhance.js's "Credux is spent on both success AND
 * failure" rule (§7). One attempt per call — the original's confirm-UI
 * loop is just repeated calls to this same use-case.
 */
export class EnhancementService {
	constructor(private readonly repo = new EnhancementRepository()) {}

	attempt(discordId: string, gearId: string): EnhanceResult {
		return db.transaction((tx): EnhanceResult => {
			const gear = this.repo.findGear(tx, discordId, gearId);
			if (!gear) return { status: 'not-found' };

			const attempt = nextAttempt(gear.tier, gear.enhancement);
			if (!attempt) return { status: 'maxed-or-not-enhanceable' };

			const credux = this.repo.getCredux(tx, discordId);
			if (credux < attempt.cost) return { status: 'insufficient-credux', needed: attempt.cost, have: credux };

			this.repo.spendCredux(tx, discordId, attempt.cost);

			const rng = createRng(createSecureSeed());
			const succeeded = rng() < attempt.successRate;
			if (!succeeded) return { status: 'failure', cost: attempt.cost };

				const newLevel = gear.enhancement + 1;
				if (gear.kind === 'weapon') {
					const newAtk = computeWeaponCurrAtk(gear.baseAtk!, gear.tier, newLevel);
					this.repo.applyWeaponSuccess(tx, discordId, gearId, newLevel, newAtk);
				} else {
					const { hp, def } = computeArmorCurrStats(gear.baseHp!, gear.baseDef!, newLevel, gear.tier);
					this.repo.applyArmorSuccess(tx, discordId, gearId, newLevel, hp, def);
				}
			return { status: 'success', newLevel, cost: attempt.cost };
		});
	}
}
