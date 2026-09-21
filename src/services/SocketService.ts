import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { SocketStateRepository } from '../repositories/SocketStateRepository.js';
import { logger } from '../utils/logger.js';
import { RuneRepository } from '../repositories/RuneRepository.js';
import { GearRepository } from '../repositories/GearRepository.js';
import { ESSENCE_FIELDS } from './LootService.js';
import {
	SOCKET_UNLOCK_COST_NEEDED,
	SOCKET_UNLOCK_DONE,
	SOCKET_UNLOCK_LIMIT,
	SOCKET_UNLOCK_NO_REGISTER,
	SOCKET_UNLOCK_NOT_OWNED,
} from '../text/socket.js';

export type SocketResult =
	| { status: 'rune-not-owned' }
	| { status: 'gear-not-owned' }
	| { status: 'invalid-slot' }
	| { status: 'slot-occupied' }
	| { status: 'lane-mismatch'; expected: string; actual: string }
	| { status: 'ok' };

export type UnsocketResult = { status: 'rune-not-owned' } | { status: 'not-socketed' } | { status: 'ok' };

export interface SocketDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		SocketStateRepository,
		'lockBag' | 'findWeaponTier' | 'findArmorTier' | 'findUnlockCost' | 'updateBag'
	>;
}

/**
 * Facade for `/socket equip|unequip|unlock`. Ported from commands/rpg/socket.js's
 * locateSlot/writeSockets: the gear row's own `native_sockets` JSON array
 * is the real source of truth for which rune sits in which slot (not just
 * user_runes.socketedInto, which is kept as a denormalized convenience
 * field for RuneRepository.findSocketedEffects). Both lanes have one free
 * slot; additional native slots use the seeded unlock costs.
 */

export class SocketService {
	private readonly persistence: PersistenceContext;
	private readonly runes: Pick<RuneRepository, 'findOwned' | 'equip' | 'unequip'>;
	private readonly gear: Pick<
		GearRepository,
		'findSocketInfo' | 'clearRuneFromAnyGear' | 'writeNativeSockets' | 'writeOppositeSockets'
	>;
	private readonly queries: Pick<
		SocketStateRepository,
		'lockBag' | 'findWeaponTier' | 'findArmorTier' | 'findUnlockCost' | 'updateBag'
	>;

	constructor(
		runes?: Pick<RuneRepository, 'findOwned' | 'equip' | 'unequip'>,
		gear?: Pick<
			GearRepository,
			'findSocketInfo' | 'clearRuneFromAnyGear' | 'writeNativeSockets' | 'writeOppositeSockets'
		>,
		options: SocketDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.runes = runes ?? new RuneRepository();
		this.gear = gear ?? new GearRepository();
		this.queries = options.queries ?? new SocketStateRepository();
	}

	async equip(
		discordId: string,
		runeUid: string,
		gearId: string,
		slotNum: number,
		lane: 'native' | 'opposite' = 'native',
	): Promise<SocketResult> {
		return this.persistence.unitOfWork.run(async (tx): Promise<SocketResult> => {
			await this.queries.lockBag(tx, discordId);
			const rune = await this.runes.findOwned(tx, discordId, runeUid);
			if (!rune) return { status: 'rune-not-owned' };

			const info = await this.gear.findSocketInfo(tx, discordId, gearId);
			if (!info) return { status: 'gear-not-owned' };

			const sockets = lane === 'native' ? info.nativeSockets : info.oppositeSockets;
			// Existing starter items had []: the first slot is free, materialized on use.
			if (sockets.length === 0) sockets.push(null);
			const index = slotNum - 1;
			if (!Number.isInteger(slotNum) || index < 0 || index >= sockets.length) return { status: 'invalid-slot' };

			const expectedLane = lane;
			if (rune.lane !== expectedLane)
				return { status: 'lane-mismatch', expected: expectedLane, actual: rune.lane };

			if (sockets[index] != null && sockets[index] !== runeUid) {
				return { status: 'slot-occupied' };
			}

			// Auto-unsocket from wherever it currently sits — another piece of gear, or ANOTHER SLOT ON THIS SAME GEAR (else the uid would end up listed in two slots).
			if (rune.socketedInto) {
				await this.gear.clearRuneFromAnyGear(tx, discordId, rune.socketedInto, runeUid);
			}

			const next = sockets.map((uid) => (uid === runeUid ? null : uid));
			next[index] = runeUid;
			if (lane === 'native') await this.gear.writeNativeSockets(tx, discordId, gearId, info.kind, next);
			else await this.gear.writeOppositeSockets(tx, discordId, gearId, info.kind, next);
			await this.runes.equip(tx, runeUid, gearId);

			logger.info({ user: discordId, rune: runeUid, gear: gearId, slot: slotNum, lane }, 'rune-socketed');
			return { status: 'ok' };
		});
	}

	async unequip(discordId: string, runeUid: string): Promise<UnsocketResult> {
		return this.persistence.unitOfWork.run(async (tx): Promise<UnsocketResult> => {
			await this.queries.lockBag(tx, discordId);
			const rune = await this.runes.findOwned(tx, discordId, runeUid);
			if (!rune) return { status: 'rune-not-owned' };
			if (!rune.socketedInto) return { status: 'not-socketed' };

			await this.gear.clearRuneFromAnyGear(tx, discordId, rune.socketedInto, runeUid);
			await this.runes.unequip(tx, runeUid);
			logger.info({ user: discordId, rune: runeUid, from: rune.socketedInto }, 'rune-unequipped');
			return { status: 'ok' };
		});
	}

	async unlock(discordId: string, gearId: string): Promise<string> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [bag] = await this.queries.lockBag(tx, discordId);
			if (!bag) return SOCKET_UNLOCK_NO_REGISTER;
			const info = await this.gear.findSocketInfo(tx, discordId, gearId);
			if (!info) return SOCKET_UNLOCK_NOT_OWNED;
			const rows =
				info.kind === 'weapon'
					? await this.queries.findWeaponTier(tx, gearId)
					: await this.queries.findArmorTier(tx, gearId);
			const next = Math.max(1, info.nativeSockets.length) + 1;
			const [cost] = await this.queries.findUnlockCost(tx, rows[0].tier, next);
			if (!cost) return SOCKET_UNLOCK_LIMIT;
			if (!Object.hasOwn(ESSENCE_FIELDS, cost.essenceTier)) throw new Error('Invalid socket essence tier');
			const field = ESSENCE_FIELDS[cost.essenceTier as keyof typeof ESSENCE_FIELDS];
			if (bag.credux < cost.creduxCost || bag[field] < cost.essenceCost)
				return SOCKET_UNLOCK_COST_NEEDED(cost.creduxCost, cost.essenceCost, cost.essenceTier);
			await this.queries.updateBag(tx, discordId, {
				credux: bag.credux - cost.creduxCost,
				[field]: bag[field] - cost.essenceCost,
			});
			await this.gear.writeNativeSockets(tx, discordId, gearId, info.kind, [
				...(info.nativeSockets.length ? info.nativeSockets : [null]),
				null,
			]);
			return SOCKET_UNLOCK_DONE(next);
		});
	}
}
