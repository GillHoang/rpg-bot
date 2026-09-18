import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag, gameLogs } from '../db/schema.js';
import { DeityRepository } from '../repositories/DeityRepository.js';
import { TIER_ESSENCE_FIELD } from '../config/gachaRates.js';
import { nextSigilCost, ascensionCost, MAX_SIGILS } from '../config/ascension.js';

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

/**
 * Facade for the Sigil/Ascension system, ported from config/ascension.js.
 * This REPLACES the legacy deity-enhancement system (engine/
 * deityEnhancement.js, "+10 levels, double stats") which is not ported —
 * per the original's own comment, Ascension supersedes it entirely.
 */
export class AscensionService {
	constructor(private readonly deities = new DeityRepository()) {}

	async addSigil(discordId: string, userDeityId: number): Promise<SigilResult> {
		return db.transaction(async (tx): Promise<SigilResult> => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
			const progress = await this.deities.findOwnedProgress(tx, discordId, userDeityId);
			if (!progress || progress.userDeityId == null) return { status: 'not-owned' };

			const next = nextSigilCost(progress.tier, progress.sigils);
			if (!next) return { status: 'maxed' };

			const field = TIER_ESSENCE_FIELD[progress.tier];
			const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
			if (!bag) throw new Error(`addSigil: no users_bag row for ${discordId}`);
			const have = bag[field];
			if (have < next.essence) return { status: 'insufficient-essence', needed: next.essence, have };

			await tx
				.update(usersBag)
				.set({ [field]: have - next.essence } as Partial<typeof usersBag.$inferInsert>)
				.where(eq(usersBag.discordId, discordId));
			await tx.insert(gameLogs).values({
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
		return db.transaction(async (tx): Promise<AscendResult> => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
			const progress = await this.deities.findOwnedProgress(tx, discordId, userDeityId);
			if (!progress) return { status: 'not-owned' };
			if (progress.ascended) return { status: 'already-ascended' };
			if (progress.sigils < MAX_SIGILS) return { status: 'not-enough-sigils', have: progress.sigils };

			const cost = ascensionCost(progress.tier);
			if (!cost) return { status: 'not-owned' };

			const field = TIER_ESSENCE_FIELD[progress.tier];
			const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).limit(1);
			if (!bag) throw new Error(`ascend: no users_bag row for ${discordId}`);
			const essenceHave = bag[field];
			if (essenceHave < cost.essence || bag.credux < cost.credux) {
				return { status: 'insufficient-resources', neededEssence: cost.essence, neededCredux: cost.credux };
			}

			await tx
				.update(usersBag)
				.set({ credux: bag.credux - cost.credux, [field]: essenceHave - cost.essence } as Partial<
					typeof usersBag.$inferInsert
				>)
				.where(eq(usersBag.discordId, discordId));
			await tx.insert(gameLogs).values({
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
