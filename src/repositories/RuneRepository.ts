import { eq, and } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userRunes, runeRoster } from '../db/schema.js';
import type { RuneEffectKey } from '../config/runes.js';

export interface SocketedRuneEffect {
	effectKey: RuneEffectKey;
	value: number;
}

export interface OwnedRune {
	runeUid: string;
	effectKey: RuneEffectKey;
	lane: string;
	value: number;
	socketedInto: string | null;
}

/**
 * NOTE (documented simplification, see README M5 section): socket
 * slot-count and lane (native vs opposite) validation from the original
 * socket.js is not enforced here — equip only checks the rune is owned
 * and not locked. Unlocking sockets (socket_unlock_cost) is not ported.
 */
export class RuneRepository {
	async findOwned(executor: Executor, discordId: string, runeUid: string): Promise<OwnedRune | null> {
		const [row] = await executor
			.select({
				runeUid: userRunes.runeUid,
				effectKey: runeRoster.effectKey,
				lane: runeRoster.lane,
				rolledValue: userRunes.rolledValue,
				rosterValue: runeRoster.value,
				socketedInto: userRunes.socketedInto,
			})
			.from(userRunes)
			.innerJoin(runeRoster, eq(userRunes.runeId, runeRoster.runeId))
			.where(and(eq(userRunes.discordId, discordId), eq(userRunes.runeUid, runeUid)))
			.limit(1);
		if (!row) return null;
		return {
			runeUid: row.runeUid,
			effectKey: row.effectKey as RuneEffectKey,
			lane: row.lane,
			value: row.rolledValue ?? row.rosterValue,
			socketedInto: row.socketedInto,
		};
	}

	/** ALL runes currently socketed into one gear id — caller splits by STAT_EFFECT_KEYS vs COMBAT_EFFECT_KEYS. */
	async findSocketedEffects(executor: Executor, gearId: string): Promise<SocketedRuneEffect[]> {
		const rows = await executor
			.select({
				effectKey: runeRoster.effectKey,
				rolledValue: userRunes.rolledValue,
				rosterValue: runeRoster.value,
			})
			.from(userRunes)
			.innerJoin(runeRoster, eq(userRunes.runeId, runeRoster.runeId))
			.where(eq(userRunes.socketedInto, gearId));
		return rows.map((r: { effectKey: string; rolledValue: number | null; rosterValue: number }) => ({
			effectKey: r.effectKey as RuneEffectKey,
			value: r.rolledValue ?? r.rosterValue,
		}));
	}

	async equip(executor: Executor, runeUid: string, gearId: string): Promise<void> {
		await executor.update(userRunes).set({ socketedInto: gearId }).where(eq(userRunes.runeUid, runeUid));
	}

	async unequip(executor: Executor, runeUid: string): Promise<void> {
		await executor.update(userRunes).set({ socketedInto: null }).where(eq(userRunes.runeUid, runeUid));
	}
}
