import { ASCENSION_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { AppError } from '../../../shared/kernel/Result.js';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { AscensionRepository } from '../infrastructure/AscensionRepository.js';
import type { usersBag } from '../../../db/schema.js';
import { DeityService } from './DeityService.js';
import { TIER_ESSENCE_FIELD } from '../../../shared/config/gachaRates.js';
import { nextSigilCost, ascensionCost, MAX_SIGILS } from '../../../shared/config/ascension.js';

export type SigilResult =
	| { status: 'not-owned' }
	| { status: 'maxed' }
	| { status: 'insufficient-essence'; needed: number; have: number }
	| { status: 'ok'; newSigils: number };

export type AscendResult =
	| { status: 'not-owned' }
	| { status: 'already-ascended' }
	| { status: 'not-enough-sigils'; have: number }
	| { status: 'insufficient-resources'; neededEssence: number; neededCredux: number }
	| { status: 'ok' };

export interface AscensionDependencies {
	persistence: PersistenceContext;
	queries?: Pick<
		AscensionRepository,
		| 'lockBag'
		| 'findBag'
		| 'updateSigilBalance'
		| 'insertSigilLog'
		| 'updateAscensionBalances'
		| 'insertAscensionLog'
	>;
}

/**
 * Facade for the Sigil/Ascension system, ported from config/ascension.js.
 * This REPLACES the legacy deity-enhancement system (engine/
 * deityEnhancement.js, "+10 levels, double stats") which is not ported —
 * per the original's own comment, Ascension supersedes it entirely.
 */

export class AscensionService {
	private readonly persistence: PersistenceContext;
	private readonly deities: Pick<DeityService, 'findOwnedProgress' | 'setSigils' | 'setAscended'>;
	private readonly queries: NonNullable<AscensionDependencies['queries']>;
	constructor(
		deities: Pick<DeityService, 'findOwnedProgress' | 'setSigils' | 'setAscended'> | undefined = undefined,
		options: AscensionDependencies,
	) {
		this.persistence = requirePersistence(options, 'AscensionService');
		this.deities = deities ?? new DeityService();
		this.queries = options.queries ?? new AscensionRepository();
	}

	async addSigil(discordId: string, userDeityId: number): Promise<SigilResult> {
		return this.persistence.unitOfWork.run(async (tx): Promise<SigilResult> => {
			await this.queries.lockBag(tx, discordId);
			const progress = await this.deities.findOwnedProgress(tx, discordId, userDeityId);
			if (progress?.userDeityId == null) return { status: 'not-owned' };

			const next = nextSigilCost(progress.tier, progress.sigils);
			if (!next) return { status: 'maxed' };

			const field = TIER_ESSENCE_FIELD[progress.tier];
			const [bag] = await this.queries.findBag(tx, discordId);
			if (!bag)
				throw new AppError('ASCENSION_SIGIL_MISSING_BAG', ASCENSION_ERROR_TEXT.sigilMissingBag(discordId));
			const have = bag[field];
			if (have < next.essence) return { status: 'insufficient-essence', needed: next.essence, have };

			await this.queries.updateSigilBalance(tx, discordId, { [field]: have - next.essence } as Partial<
				typeof usersBag.$inferInsert
			>);
			await this.queries.insertSigilLog(tx, {
				discordId,
				action: 'Sigil',
				itemType: field,
				previousEssenceCount: have,
				updatedEssenceCount: have - next.essence,
			});

			const newSigils = progress.sigils + 1;
			await this.deities.setSigils(tx, userDeityId, newSigils);
			return { status: 'ok', newSigils };
		});
	}

	async ascend(discordId: string, userDeityId: number): Promise<AscendResult> {
		return this.persistence.unitOfWork.run(async (tx): Promise<AscendResult> => {
			await this.queries.lockBag(tx, discordId);
			const progress = await this.deities.findOwnedProgress(tx, discordId, userDeityId);
			if (!progress) return { status: 'not-owned' };
			if (progress.ascended) return { status: 'already-ascended' };
			if (progress.sigils < MAX_SIGILS) return { status: 'not-enough-sigils', have: progress.sigils };

			const cost = ascensionCost(progress.tier);
			if (!cost) return { status: 'not-owned' };

			const field = TIER_ESSENCE_FIELD[progress.tier];
			const [bag] = await this.queries.findBag(tx, discordId);
			if (!bag) throw new AppError('ASCENSION_MISSING_BAG', ASCENSION_ERROR_TEXT.ascendMissingBag(discordId));
			const essenceHave = bag[field];
			if (essenceHave < cost.essence || bag.credux < cost.credux) {
				return { status: 'insufficient-resources', neededEssence: cost.essence, neededCredux: cost.credux };
			}

			await this.queries.updateAscensionBalances(tx, discordId, {
				credux: bag.credux - cost.credux,
				[field]: essenceHave - cost.essence,
			} as Partial<typeof usersBag.$inferInsert>);
			await this.queries.insertAscensionLog(tx, {
				discordId,
				action: 'Ascension',
				previousCredux: bag.credux,
				updatedCredux: bag.credux - cost.credux,
			});

			await this.deities.setAscended(tx, userDeityId);
			return { status: 'ok' };
		});
	}
}
