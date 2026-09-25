import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { userDeities, deityRoster, userRunes, userWeapons, usersBag, weaponRoster } from '../../../db/schema.js';

export interface WeaponDetailRow {
	weaponId: string;
	weaponRosterId: number;
	name: string;
	tier: string;
	passiveKey: string;
	passiveName: string;
	passiveDescription: string;
	lore: string | null;
	baseAtk: number;
	currAtk: number;
	crit: number;
	quality: string;
	enhancement: number;
	isLocked: boolean;
	attachedDeityId: number | null;
	wielderName: string | null;
}

/** Persistence-only weapon operations; rolls and business rules live in WeaponService. */
export class WeaponRepository {
	async lockBag(tx: Executor, discordId: string) {
		return tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
	}

	async findWeapon(tx: Executor, discordId: string, weaponId: string): Promise<WeaponDetailRow[]> {
		return tx
			.select({
				weaponId: userWeapons.weaponId,
				weaponRosterId: userWeapons.weaponRosterId,
				name: weaponRoster.name,
				tier: weaponRoster.tier,
				passiveKey: weaponRoster.passiveKey,
				passiveName: weaponRoster.passiveName,
				passiveDescription: weaponRoster.passiveDescription,
				lore: weaponRoster.lore,
				baseAtk: userWeapons.baseAtk,
				currAtk: userWeapons.currAtk,
				crit: userWeapons.crit,
				quality: userWeapons.quality,
				enhancement: userWeapons.enhancement,
				isLocked: userWeapons.isLocked,
				attachedDeityId: userWeapons.attachedDeityId,
				wielderName: deityRoster.name,
			})
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.leftJoin(userDeities, eq(userWeapons.attachedDeityId, userDeities.userDeityId))
			.leftJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)))
			.limit(1);
	}

	/**
	 * Locked read used by mutations that derive their next state from the
	 * current row (quality upgrade). `of: userWeapons` keeps the join from
	 * locking roster/deity catalog rows shared by every player.
	 */
	async findWeaponForUpdate(tx: Executor, discordId: string, weaponId: string) {
		return tx
			.select({ weaponId: userWeapons.weaponId, name: weaponRoster.name, quality: userWeapons.quality })
			.from(userWeapons)
			.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)))
			.limit(1)
			.for('update', { of: userWeapons });
	}

	async findEquippedRefs(tx: Executor, weaponId: string) {
		return tx
			.select({ weaponId: userWeapons.weaponId })
			.from(userWeapons)
			.where(and(eq(userWeapons.weaponId, weaponId), isNotNull(userWeapons.attachedDeityId)))
			.limit(1);
	}

	async findOwnedDeity(tx: Executor, discordId: string, userDeityId: number) {
		return tx
			.select({ userDeityId: userDeities.userDeityId })
			.from(userDeities)
			.where(and(eq(userDeities.discordId, discordId), eq(userDeities.userDeityId, userDeityId)))
			.limit(1);
	}

	async findWielder(tx: Executor, userDeityId: number) {
		return tx
			.select({ weaponId: userWeapons.weaponId })
			.from(userWeapons)
			.where(eq(userWeapons.attachedDeityId, userDeityId))
			.limit(1);
	}

	/** Attaches a weapon to a deity, freeing both sides' previous bonds first. */
	async attachWeapon(tx: Executor, discordId: string, weaponId: string, userDeityId: number) {
		await tx
			.update(userWeapons)
			.set({ attachedDeityId: null })
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)));
		await tx.update(userWeapons).set({ attachedDeityId: null }).where(eq(userWeapons.attachedDeityId, userDeityId));
		await tx
			.update(userWeapons)
			.set({ attachedDeityId: userDeityId })
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)));
	}

	async detachWeapon(tx: Executor, discordId: string, weaponId: string) {
		await tx
			.update(userWeapons)
			.set({ attachedDeityId: null })
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)));
	}

	async findWeaponPool(tx: Executor, tier: string) {
		return tx
			.select()
			.from(weaponRoster)
			.where(and(eq(weaponRoster.tier, tier), eq(weaponRoster.isAvailable, true)))
			.orderBy(weaponRoster.weaponRosterId);
	}

	async insertWeapon(tx: Executor, values: typeof userWeapons.$inferInsert) {
		await tx.insert(userWeapons).values(values);
	}

	async updateQuality(tx: Executor, discordId: string, weaponId: string, quality: string) {
		await tx
			.update(userWeapons)
			.set({ quality })
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)));
	}

	async detachSocketedRunes(tx: Executor, weaponId: string) {
		await tx.update(userRunes).set({ socketedInto: null }).where(eq(userRunes.socketedInto, weaponId));
	}

	async deleteWeapon(tx: Executor, discordId: string, weaponId: string) {
		await tx
			.delete(userWeapons)
			.where(and(eq(userWeapons.discordId, discordId), eq(userWeapons.weaponId, weaponId)));
	}

	/**
	 * Atomic balance delta (single SQL statement). Callers that must guard a
	 * cost still `lockBag` first; callers that only credit/debit a known
	 * amount (dismantle/sell) are safe without a prior lock — a read-modify-
	 * write on a JS snapshot would let two concurrent ops overwrite each
	 * other's delta (lost update / erased debit = net currency creation).
	 */
	async adjustBag(tx: Executor, discordId: string, patch: { credux?: number; weaponShards?: number }) {
		const [row] = await tx
			.update(usersBag)
			.set({
				credux: sql`${usersBag.credux} + ${patch.credux ?? 0}`,
				weaponShards: sql`${usersBag.weaponShards} + ${patch.weaponShards ?? 0}`,
			})
			.where(eq(usersBag.discordId, discordId))
			.returning({ credux: usersBag.credux, weaponShards: usersBag.weaponShards });
		return row ?? null;
	}
}
