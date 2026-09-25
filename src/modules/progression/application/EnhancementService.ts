import { LOG_EVENT_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { GameplayProgressCoordinator } from '../../../shared/progress/gameplayProgress.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { EnhancementStateRepository } from '../infrastructure/EnhancementStateRepository.js';
import { rollChance } from '../../../shared/utils/weightedRandom.js';
import { logger } from '../../../shared/utils/logger.js';
import { EnhancementRepository } from '../infrastructure/EnhancementRepository.js';
import {
	nextAttempt,
	isEnhanceableTier,
	computeWeaponCurrAtk,
	computeArmorCurrStats,
} from '../../../shared/config/enhancement.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { EMIT_ONLY_EVENT_BUS, type EventBus } from '../../../shared/kernel/EventBus.js';
import { systemClock, type Clock } from '../../../shared/kernel/clock.js';

export type EnhanceResult =
	| { status: 'not-found' }
	| { status: 'not-enhanceable' }
	| { status: 'maxed' }
	| { status: 'insufficient-credux'; needed: number; have: number }
	| { status: 'success'; newLevel: number; cost: number }
	| { status: 'failure'; cost: number };

export interface EnhancementDependencies {
	progress?: Pick<GameplayProgressCoordinator, 'apply'>;
	persistence: PersistenceContext;
	clock?: Clock;
	queries?: Pick<EnhancementStateRepository, 'lockBag'>;
}

/**
 * Facade for `/enhance`. Ported from engine/enhancement.js's pure math +
 * commands/rpg/enhance.js's "Credux is spent on both success AND
 * failure" rule (§7). One attempt per call — the original's confirm-UI
 * loop is just repeated calls to this same use-case.
 */

export class EnhancementService {
	private readonly progress: Pick<GameplayProgressCoordinator, 'apply'>;
	private readonly persistence: PersistenceContext;
	private readonly clock: Clock;
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
		options: EnhancementDependencies = {} as EnhancementDependencies,
	) {
		this.persistence = requirePersistence(options, 'EnhancementService');
		this.clock = options.clock ?? systemClock;
		this.progress = options.progress ?? new GameplayProgressCoordinator({ persistence: this.persistence });
		this.repo = repo ?? new EnhancementRepository();
		this.events = events ?? EMIT_ONLY_EVENT_BUS;
		this.queries = options.queries ?? new EnhancementStateRepository();
	}

	async attempt(discordId: string, gearId: string): Promise<EnhanceResult> {
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<EnhanceResult> => {
			await this.queries.lockBag(tx, discordId);
			const gear = await this.repo.findGear(tx, discordId, gearId);
			if (!gear) return { status: 'not-found' };

			// Common starter gear has no cost table: report it honestly
			// instead of the misleading "already maxed".
			if (!isEnhanceableTier(gear.tier)) return { status: 'not-enhanceable' };
			const attempt = nextAttempt(gear.tier, gear.enhancement);
			if (!attempt) return { status: 'maxed' };

			const credux = await this.repo.getCredux(tx, discordId);
			if (credux < attempt.cost) return { status: 'insufficient-credux', needed: attempt.cost, have: credux };

			await this.repo.spendCredux(tx, discordId, attempt.cost);
			await this.progress.apply(tx, discordId, 'enhance', this.clock.now());

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
			this.events.emit('gear.enhanced', {
				discordId,
				success: result.status === 'success',
				progressApplied: true,
			});
		}
		if (result.status === 'success') {
			logger.info(
				{ user: discordId, gearId, to: `+${result.newLevel - 1}`, cost: result.cost },
				LOG_EVENT_TEXT.gearEnhanced,
			);
		} else if (result.status === 'failure') {
			logger.info({ user: discordId, gearId, cost: result.cost }, LOG_EVENT_TEXT.gearEnhanceFailed);
		}
		return result;
	}
}
