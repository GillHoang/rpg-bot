import { rollChance } from '../utils/weightedRandom.js';
import { db } from '../db/client.js';
import { EnhancementRepository } from '../repositories/EnhancementRepository.js';
import { nextAttempt, computeWeaponCurrAtk, computeArmorCurrStats } from '../config/enhancement.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { eq } from 'drizzle-orm';
import { usersBag } from '../db/schema.js';

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

	async attempt(discordId: string, gearId: string): Promise<EnhanceResult> {
		return db.transaction(async (tx): Promise<EnhanceResult> => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
			const gear = await this.repo.findGear(tx, discordId, gearId);
			if (!gear) return { status: 'not-found' };

			const attempt = nextAttempt(gear.tier, gear.enhancement);
			if (!attempt) return { status: 'maxed-or-not-enhanceable' };

			const credux = await this.repo.getCredux(tx, discordId);
			if (credux < attempt.cost) return { status: 'insufficient-credux', needed: attempt.cost, have: credux };

			await this.repo.spendCredux(tx, discordId, attempt.cost);

			const rng = createRng(createSecureSeed());
			const succeeded = rollChance(attempt.successRate, rng);
			if (!succeeded) return { status: 'failure', cost: attempt.cost };

			const newLevel = gear.enhancement + 1;
			if (gear.kind === 'weapon') {
				const newAtk = computeWeaponCurrAtk(gear.baseAtk!, gear.tier, newLevel);
				await this.repo.applyWeaponSuccess(tx, discordId, gearId, newLevel, newAtk);
			} else {
				const { hp, def } = computeArmorCurrStats(gear.baseHp!, gear.baseDef!, newLevel, gear.tier);
				await this.repo.applyArmorSuccess(tx, discordId, gearId, newLevel, hp, def);
			}
			return { status: 'success', newLevel, cost: attempt.cost };
		});
	}
}
