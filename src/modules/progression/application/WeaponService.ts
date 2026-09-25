import { randomUUID } from 'node:crypto';
import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { AppError, err, ok, type Result } from '../../../shared/kernel/Result.js';
import { createRng, createSecureSeed } from '../../combat-shared/domain/Rng.js';
import { choose, GEAR_STATS } from '../../../shared/config/chestLoot.js';
import { randInt } from '../../../shared/config/raidLoot.js';
import {
	WEAPON_QUALITY_ATK_MULT,
	WEAPON_QUALITY_CRIT_BONUS,
	WEAPON_CRATE_COST,
	dismantleYield,
	isWeaponQuality,
	nextWeaponQuality,
	rollCrateTier,
	rollWeaponQuality,
	sellValue,
	WEAPON_UPGRADE_COSTS,
	type WeaponQuality,
} from '../../../shared/config/weaponQuality.js';
import { enhancementPlus } from '../../../shared/utils/enhancementDisplay.js';
import { formatNumber } from '../../../shared/ui/text/format.js';
import {
	WEAPON_ATTACHED,
	WEAPON_CRATE_RESULT,
	WEAPON_DETACHED,
	WEAPON_DEITY_NOT_OWNED,
	WEAPON_DETAIL_BODY,
	WEAPON_DETAIL_TITLE,
	WEAPON_DISMANTLED,
	WEAPON_EQUIPPED_GUARD,
	WEAPON_INSUFFICIENT_CREDUX,
	WEAPON_INSUFFICIENT_SHARDS,
	WEAPON_LOCKED_GUARD,
	WEAPON_LOCKED_SUFFIX,
	WEAPON_MAX_QUALITY,
	WEAPON_NOT_ATTACHED,
	WEAPON_NOT_FOUND,
	WEAPON_NO_CHARACTER,
	WEAPON_QUALITY_LABELS,
	WEAPON_SOLD,
	WEAPON_UNWIELDED,
	WEAPON_UPGRADED,
	WEAPON_WIELDED_BY,
} from '../../../shared/ui/text/weapon.js';
import { WeaponRepository } from '../infrastructure/WeaponRepository.js';

export interface WeaponServiceDependencies {
	persistence: PersistenceContext;
	queries?: WeaponRepository;
}

/**
 * OwO-style weapon lifecycle: crate pulls, quality upgrades, dismantling and
 * selling. Quality multiplies stats at assembly time (StatAssemblyService),
 * so upgrades only move the grade column — no stat recompute here.
 */
export class WeaponService {
	private readonly persistence: PersistenceContext;
	private readonly repo: WeaponRepository;

	constructor(options: WeaponServiceDependencies) {
		this.persistence = requirePersistence(options, 'WeaponService');
		this.repo = options.queries ?? new WeaponRepository();
	}

	async view(discordId: string, weaponId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [row] = await this.repo.findWeapon(tx, discordId, weaponId);
			if (!row) return err(new AppError('WEAPON_NOT_FOUND', WEAPON_NOT_FOUND));
			return ok(this.renderDetail(row));
		});
	}

	/** Bonds a weapon to a deity (one weapon per deity). Only the pantheon
	 * lead's weapon counts in battle — see StatAssemblyService. */
	async attach(discordId: string, weaponId: string, userDeityId: number): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [weapon] = await this.repo.findWeapon(tx, discordId, weaponId);
			if (!weapon) return err(new AppError('WEAPON_NOT_FOUND', WEAPON_NOT_FOUND));
			const [deity] = await this.repo.findOwnedDeity(tx, discordId, userDeityId);
			if (!deity) return err(new AppError('WEAPON_DEITY_NOT_OWNED', WEAPON_DEITY_NOT_OWNED));
			await this.repo.attachWeapon(tx, discordId, weaponId, userDeityId);
			const [updated] = await this.repo.findWeapon(tx, discordId, weaponId);
			return ok(WEAPON_ATTACHED(updated?.name ?? weapon.name, updated?.wielderName ?? String(userDeityId)));
		});
	}

	async detach(discordId: string, weaponId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [weapon] = await this.repo.findWeapon(tx, discordId, weaponId);
			if (!weapon) return err(new AppError('WEAPON_NOT_FOUND', WEAPON_NOT_FOUND));
			if (weapon.attachedDeityId == null) return err(new AppError('WEAPON_NOT_ATTACHED', WEAPON_NOT_ATTACHED));
			await this.repo.detachWeapon(tx, discordId, weaponId);
			return ok(WEAPON_DETACHED(weapon.name));
		});
	}

	async openCrate(discordId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [bag] = await this.repo.lockBag(tx, discordId);
			if (!bag) return err(new AppError('WEAPON_NO_CHARACTER', WEAPON_NO_CHARACTER));
			if ((bag.credux ?? 0) < WEAPON_CRATE_COST) {
				return err(
					new AppError(
						'WEAPON_INSUFFICIENT_CREDUX',
						WEAPON_INSUFFICIENT_CREDUX(formatNumber(WEAPON_CRATE_COST), formatNumber(bag.credux ?? 0)),
					),
				);
			}
			const rng = createRng(createSecureSeed());
			const tier = rollCrateTier(rng);
			const pool = await this.repo.findWeaponPool(tx, tier);
			if (!pool.length) return err(new AppError('WEAPON_NOT_FOUND', WEAPON_NOT_FOUND));
			const picked = choose(pool, rng);
			const stats = GEAR_STATS[tier as keyof typeof GEAR_STATS] ?? GEAR_STATS.Rare;
			const atk = randInt(rng, stats.atk);
			const crit = randInt(rng, stats.crit);
			const quality = rollWeaponQuality(tier, rng);
			const weaponId = `w_${randomUUID()}`;
			await this.repo.insertWeapon(tx, {
				discordId,
				weaponId,
				weaponRosterId: picked.weaponRosterId,
				baseAtk: atk,
				currAtk: atk,
				crit,
				quality,
				enhancement: 1,
				isLocked: false,
				nativeSockets: [null],
				oppositeSockets: [null],
			});
			await this.repo.adjustBag(tx, discordId, { credux: -WEAPON_CRATE_COST });
			return ok(WEAPON_CRATE_RESULT({ name: picked.name, tier, quality, id: weaponId, atk, crit }));
		});
	}

	async upgrade(discordId: string, weaponId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			// Lock the bag before reading the weapon: two concurrent upgrades
			// must not both read the old quality and charge twice for one step.
			const [bag] = await this.repo.lockBag(tx, discordId);
			if (!bag) return err(new AppError('WEAPON_NO_CHARACTER', WEAPON_NO_CHARACTER));
			// Lock the weapon row too, so a concurrent dismantle/sell cannot
			// delete it between our read and our write (charge with no effect).
			const [row] = await this.repo.findWeaponForUpdate(tx, discordId, weaponId);
			if (!row) return err(new AppError('WEAPON_NOT_FOUND', WEAPON_NOT_FOUND));
			const quality: WeaponQuality = isWeaponQuality(row.quality) ? row.quality : 'Common';
			const next = nextWeaponQuality(quality);
			if (!next) return err(new AppError('WEAPON_MAX_QUALITY', WEAPON_MAX_QUALITY));
			const cost = WEAPON_UPGRADE_COSTS[quality]!;
			if ((bag.weaponShards ?? 0) < cost.shards) {
				return err(
					new AppError(
						'WEAPON_INSUFFICIENT_SHARDS',
						WEAPON_INSUFFICIENT_SHARDS(cost.shards, bag.weaponShards ?? 0),
					),
				);
			}
			if ((bag.credux ?? 0) < cost.credux) {
				return err(
					new AppError(
						'WEAPON_INSUFFICIENT_CREDUX',
						WEAPON_INSUFFICIENT_CREDUX(formatNumber(cost.credux), formatNumber(bag.credux ?? 0)),
					),
				);
			}
			await this.repo.updateQuality(tx, discordId, weaponId, next);
			await this.repo.adjustBag(tx, discordId, { credux: -cost.credux, weaponShards: -cost.shards });
			return ok(WEAPON_UPGRADED(row.name, next));
		});
	}

	async dismantle(discordId: string, weaponId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [row] = await this.repo.findWeapon(tx, discordId, weaponId);
			if (!row) return err(new AppError('WEAPON_NOT_FOUND', WEAPON_NOT_FOUND));
			if (await this.isAttached(tx, weaponId)) return err(new AppError('WEAPON_EQUIPPED', WEAPON_EQUIPPED_GUARD));
			if (row.isLocked) return err(new AppError('WEAPON_LOCKED', WEAPON_LOCKED_GUARD));
			const quality: WeaponQuality = isWeaponQuality(row.quality) ? row.quality : 'Common';
			const yield_ = dismantleYield(row.tier, quality);
			await this.repo.detachSocketedRunes(tx, weaponId);
			await this.repo.deleteWeapon(tx, discordId, weaponId);
			await this.repo.adjustBag(tx, discordId, { credux: yield_.credux, weaponShards: yield_.shards });
			return ok(WEAPON_DISMANTLED(row.name, yield_.shards, formatNumber(yield_.credux)));
		});
	}

	async sell(discordId: string, weaponId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [row] = await this.repo.findWeapon(tx, discordId, weaponId);
			if (!row) return err(new AppError('WEAPON_NOT_FOUND', WEAPON_NOT_FOUND));
			if (await this.isAttached(tx, weaponId)) return err(new AppError('WEAPON_EQUIPPED', WEAPON_EQUIPPED_GUARD));
			if (row.isLocked) return err(new AppError('WEAPON_LOCKED', WEAPON_LOCKED_GUARD));
			const quality: WeaponQuality = isWeaponQuality(row.quality) ? row.quality : 'Common';
			const value = sellValue(row.tier, quality);
			await this.repo.detachSocketedRunes(tx, weaponId);
			await this.repo.deleteWeapon(tx, discordId, weaponId);
			await this.repo.adjustBag(tx, discordId, { credux: value });
			return ok(WEAPON_SOLD(row.name, formatNumber(value)));
		});
	}

	private async isAttached(tx: Parameters<WeaponRepository['findEquippedRefs']>[0], weaponId: string) {
		const [ref] = await this.repo.findEquippedRefs(tx, weaponId);
		return ref != null;
	}

	private renderDetail(row: {
		name: string;
		tier: string;
		quality: string;
		enhancement: number;
		weaponId: string;
		currAtk: number;
		crit: number;
		passiveName: string;
		passiveDescription: string;
		lore: string | null;
		isLocked: boolean;
		wielderName: string | null;
	}): string {
		const quality: WeaponQuality = isWeaponQuality(row.quality) ? row.quality : 'Common';
		const effAtk = Math.floor(row.currAtk * WEAPON_QUALITY_ATK_MULT[quality]);
		const effCrit = row.crit + WEAPON_QUALITY_CRIT_BONUS[quality];
		return (
			WEAPON_DETAIL_TITLE(row.name) +
			'\n' +
			WEAPON_DETAIL_BODY({
				tier: row.tier,
				quality: WEAPON_QUALITY_LABELS[quality] ?? quality,
				plus: enhancementPlus(row.enhancement),
				id: row.weaponId,
				atk: row.currAtk,
				effAtk,
				crit: row.crit,
				effCrit,
				passiveName: row.passiveName,
				passiveDescription: row.passiveDescription,
				lore: row.lore ?? '',
				wielder: row.wielderName ? `\n${WEAPON_WIELDED_BY(row.wielderName)}` : `\n${WEAPON_UNWIELDED}`,
				locked: row.isLocked ? `\n${WEAPON_LOCKED_SUFFIX}` : '',
			})
		);
	}
}
