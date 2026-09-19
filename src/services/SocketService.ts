import { db } from '../db/client.js';
import { RuneRepository } from '../repositories/RuneRepository.js';
import { GearRepository } from '../repositories/GearRepository.js';
import { and, eq } from 'drizzle-orm';
import { usersBag, userWeapons, userArmors, weaponRoster, armorRoster, socketUnlockCost } from '../db/schema.js';
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

/**
 * Facade for `/socket equip|unequip|unlock`. Ported from commands/rpg/socket.js's
 * locateSlot/writeSockets: the gear row's own `native_sockets` JSON array
 * is the real source of truth for which rune sits in which slot (not just
 * user_runes.socketedInto, which is kept as a denormalized convenience
 * field for RuneRepository.findSocketedEffects). Both lanes have one free
 * slot; additional native slots use the seeded unlock costs.
 */
export class SocketService {
	constructor(
		private readonly runes = new RuneRepository(),
		private readonly gear = new GearRepository(),
	) {}

	async equip(
		discordId: string,
		runeUid: string,
		gearId: string,
		slotNum: number,
		lane: 'native' | 'opposite' = 'native',
	): Promise<SocketResult> {
		return db.transaction(async (tx): Promise<SocketResult> => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
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

			return { status: 'ok' };
		});
	}

	async unequip(discordId: string, runeUid: string): Promise<UnsocketResult> {
		return db.transaction(async (tx): Promise<UnsocketResult> => {
			await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
			const rune = await this.runes.findOwned(tx, discordId, runeUid);
			if (!rune) return { status: 'rune-not-owned' };
			if (!rune.socketedInto) return { status: 'not-socketed' };

			await this.gear.clearRuneFromAnyGear(tx, discordId, rune.socketedInto, runeUid);
			await this.runes.unequip(tx, runeUid);
			return { status: 'ok' };
		});
	}

	async unlock(discordId: string, gearId: string): Promise<string> {
		return db.transaction(async (tx) => {
			const [bag] = await tx.select().from(usersBag).where(eq(usersBag.discordId, discordId)).for('update');
			if (!bag) return SOCKET_UNLOCK_NO_REGISTER;
			const info = await this.gear.findSocketInfo(tx, discordId, gearId);
			if (!info) return SOCKET_UNLOCK_NOT_OWNED;
			const rows =
				info.kind === 'weapon'
					? await tx
							.select({ tier: weaponRoster.tier })
							.from(userWeapons)
							.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
							.where(eq(userWeapons.weaponId, gearId))
					: await tx
							.select({ tier: armorRoster.tier })
							.from(userArmors)
							.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
							.where(eq(userArmors.armorId, gearId));
			const next = Math.max(1, info.nativeSockets.length) + 1;
			const [cost] = await tx
				.select()
				.from(socketUnlockCost)
				.where(and(eq(socketUnlockCost.tier, rows[0].tier), eq(socketUnlockCost.slotIndex, next)));
			if (!cost) return SOCKET_UNLOCK_LIMIT;
			if (!Object.hasOwn(ESSENCE_FIELDS, cost.essenceTier)) throw new Error('Invalid socket essence tier');
			const field = ESSENCE_FIELDS[cost.essenceTier as keyof typeof ESSENCE_FIELDS];
			if (bag.credux < cost.creduxCost || bag[field] < cost.essenceCost)
				return SOCKET_UNLOCK_COST_NEEDED(cost.creduxCost, cost.essenceCost, cost.essenceTier);
			await tx
				.update(usersBag)
				.set({ credux: bag.credux - cost.creduxCost, [field]: bag[field] - cost.essenceCost })
				.where(eq(usersBag.discordId, discordId));
			await this.gear.writeNativeSockets(tx, discordId, gearId, info.kind, [
				...(info.nativeSockets.length ? info.nativeSockets : [null]),
				null,
			]);
			return SOCKET_UNLOCK_DONE(next);
		});
	}
}
