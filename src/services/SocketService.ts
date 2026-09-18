import { db } from '../db/client.js';
import { RuneRepository } from '../repositories/RuneRepository.js';
import { GearRepository } from '../repositories/GearRepository.js';

export type SocketResult =
	| { status: 'rune-not-owned' }
	| { status: 'gear-not-owned' }
	| { status: 'invalid-slot' }
	| { status: 'slot-occupied' }
	| { status: 'lane-mismatch'; expected: string; actual: string }
	| { status: 'ok' };

export type UnsocketResult = { status: 'rune-not-owned' } | { status: 'not-socketed' } | { status: 'ok' };

/** Native slots take native-lane runes. Opposite-lane (cross) socketing is disabled — matches the original's "Phase 2 opposite slots off for now". The seed vocabulary is 'native' | 'opposite' (see src/seed/data/runes.ts). */
const NATIVE_LANE = 'native' as const;

/**
 * Facade for `/socket equip|unequip`. Ported from commands/rpg/socket.js's
 * locateSlot/writeSockets: the gear row's own `native_sockets` JSON array
 * is the real source of truth for which rune sits in which slot (not just
 * user_runes.socketedInto, which is kept as a denormalized convenience
 * field for RuneRepository.findSocketedEffects). Opposite-lane sockets
 * are not offered here, matching the original being disabled "for now".
 */
export class SocketService {
	constructor(
		private readonly runes = new RuneRepository(),
		private readonly gear = new GearRepository(),
	) {}

	async equip(discordId: string, runeUid: string, gearId: string, slotNum: number): Promise<SocketResult> {
		return db.transaction(async (tx): Promise<SocketResult> => {
			const rune = await this.runes.findOwned(tx, discordId, runeUid);
			if (!rune) return { status: 'rune-not-owned' };

			const info = await this.gear.findSocketInfo(tx, discordId, gearId);
			if (!info) return { status: 'gear-not-owned' };

			const index = slotNum - 1;
			if (index < 0 || index >= info.nativeSockets.length) return { status: 'invalid-slot' };

			const expectedLane = NATIVE_LANE;
			if (rune.lane !== expectedLane)
				return { status: 'lane-mismatch', expected: expectedLane, actual: rune.lane };

			if (info.nativeSockets[index] != null && info.nativeSockets[index] !== runeUid) {
				return { status: 'slot-occupied' };
			}

			// Auto-unsocket from wherever it currently sits — another piece of gear, or ANOTHER SLOT ON THIS SAME GEAR (else the uid would end up listed in two slots).
			if (rune.socketedInto) {
				await this.gear.clearRuneFromAnyGear(tx, discordId, rune.socketedInto, runeUid);
			}

			const next = info.nativeSockets.map((uid) => (uid === runeUid ? null : uid));
			next[index] = runeUid;
			await this.gear.writeNativeSockets(tx, discordId, gearId, info.kind, next);
			await this.runes.equip(tx, runeUid, gearId);

			return { status: 'ok' };
		});
	}

	async unequip(discordId: string, runeUid: string): Promise<UnsocketResult> {
		return db.transaction(async (tx): Promise<UnsocketResult> => {
			const rune = await this.runes.findOwned(tx, discordId, runeUid);
			if (!rune) return { status: 'rune-not-owned' };
			if (!rune.socketedInto) return { status: 'not-socketed' };

			await this.gear.clearRuneFromAnyGear(tx, discordId, rune.socketedInto, runeUid);
			await this.runes.unequip(tx, runeUid);
			return { status: 'ok' };
		});
	}
}
