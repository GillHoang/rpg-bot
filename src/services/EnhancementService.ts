import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { EnhancementStateRepository } from '../repositories/EnhancementStateRepository.js';
import { rollChance } from '../utils/weightedRandom.js';
import { logger } from '../utils/logger.js';
import { EnhancementRepository } from '../repositories/EnhancementRepository.js';
import { nextAttempt, computeWeaponCurrAtk, computeArmorCurrStats } from '../config/enhancement.js';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';
import { EventBus } from '../core/EventBus.js';

export type EnhanceResult =
	| { status: 'not-found' }
	| { status: 'maxed-or-not-enhanceable' }
	| { status: 'insufficient-credux'; needed: number; have: number }
	| { status: 'success'; newLevel: number; cost: number }
	| { status: 'failure'; cost: number };

export interface EnhancementDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<EnhancementStateRepository, 'lockBag'>;
}

/**
 * Facade for `/enhance`. Ported from engine/enhancement.js's pure math +
 * commands/rpg/enhance.js's "Credux is spent on both success AND
 * failure" rule (§7). One attempt per call — the original's confirm-UI
 * loop is just repeated calls to this same use-case.
 */

export class EnhancementService {
	private readonly persistence: PersistenceContext;
	private readonly repo: Pick<
		EnhancementRepository,
		'findGear' | 'getCredux' | 'spendCredux' | 'applyWeaponSuccess' | 'applyArmorSuccess'
	>;
	private readonly events: Pick<EventBus, 'emit'>;
	private readonly queries: Pick<EnhancementStateRepository, 'lockBag'>;

	constructor(
		repo?: Pick<
			EnhancementRepository,
			'findGear' | 'getCredux' | 'spendCredux' | 'applyWeaponSuccess' | 'applyArmorSuccess'
		>,
		events?: Pick<EventBus, 'emit'>,
		options: EnhancementDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.repo = repo ?? new EnhancementRepository();
		this.events = events ?? EventBus.getInstance();
		this.queries = options.queries ?? new EnhancementStateRepository();
	}

	async attempt(discordId: string, gearId: string): Promise<EnhanceResult> {
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<EnhanceResult> => {
			await this.queries.lockBag(tx, discordId);
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

		// Both success and failure count as an enhance attempt for quests.
		if (result.status === 'success' || result.status === 'failure') {
			this.events.emit('gear.enhanced', { discordId, success: result.status === 'success' });
		}
		if (result.status === 'success') {
			logger.info({ user: discordId, gearId, to: `+${result.newLevel - 1}`, cost: result.cost }, 'gear-enhanced');
		} else if (result.status === 'failure') {
			logger.info({ user: discordId, gearId, cost: result.cost }, 'gear-enhance-failed');
		}
		return result;
	}
}
