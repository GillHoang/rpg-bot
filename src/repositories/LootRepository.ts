import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import {
	armorRoster,
	weaponRoster,
	runeRoster,
	userArmors,
	userWeapons,
	userRunes,
	usersBag,
	essenceBagDef,
	gameLogs,
} from '../db/schema.js';
import { choose, GEAR_STATS } from '../config/chestLoot.js';
import { randInt } from '../config/raidLoot.js';

export class LootRepository {
	async lockBag(tx: Executor, id: string) {
		return (await tx.select().from(usersBag).where(eq(usersBag.discordId, id)).for('update'))[0];
	}
	async bags(tx: Executor) {
		return tx.select().from(essenceBagDef).orderBy(essenceBagDef.bagKey);
	}
	async rune(tx: Executor, id: string, rng: () => number, filter: { tier?: string; names?: string[] }) {
		const pool = await tx
			.select()
			.from(runeRoster)
			.where(
				and(
					eq(runeRoster.isAvailable, true),
					filter.tier ? eq(runeRoster.tier, filter.tier) : inArray(runeRoster.name, filter.names ?? []),
				),
			)
			.orderBy(runeRoster.runeId);
		if (filter.names && filter.names.some((name) => !pool.some((r) => r.name === name)))
			throw new Error('Thiếu rune trong seed shop.');
		const rune = choose(pool, rng);
		const runeUid = `r_${randomUUID()}`;
		await tx.insert(userRunes).values({ discordId: id, runeUid, runeId: rune.runeId });
		return `${rune.name} (${rune.tier}) · ID: ${runeUid}`;
	}
	async gear(tx: Executor, id: string, tier: keyof typeof GEAR_STATS, rng: () => number) {
		const stats = GEAR_STATS[tier];
		const kind = choose(['weapon', 'armor'] as const, rng);
		const uid = `${kind === 'weapon' ? 'w' : 'a'}_${randomUUID()}`;
		if (kind === 'weapon') {
			const row = choose(
				await tx
					.select()
					.from(weaponRoster)
					.where(and(eq(weaponRoster.tier, tier), eq(weaponRoster.isAvailable, true)))
					.orderBy(weaponRoster.weaponRosterId),
				rng,
			);
			const atk = randInt(rng, stats.atk);
			await tx.insert(userWeapons).values({
				discordId: id,
				weaponId: uid,
				weaponRosterId: row.weaponRosterId,
				baseAtk: atk,
				currAtk: atk,
				crit: randInt(rng, stats.crit),
				nativeSockets: [null],
				oppositeSockets: [null],
			});
			return `${row.name} (${tier}) · ID: ${uid}`;
		}
		const row = choose(
			await tx
				.select()
				.from(armorRoster)
				.where(and(eq(armorRoster.tier, tier), eq(armorRoster.isAvailable, true)))
				.orderBy(armorRoster.armorRosterId),
			rng,
		);
		const hp = randInt(rng, stats.hp),
			def = randInt(rng, stats.def);
		await tx.insert(userArmors).values({
			discordId: id,
			armorId: uid,
			armorRosterId: row.armorRosterId,
			baseHp: hp,
			currHp: hp,
			baseDef: def,
			currDef: def,
			nativeSockets: [null],
			oppositeSockets: [null],
		});
		return `${row.name} (${tier}) · ID: ${uid}`;
	}
	async log(tx: Executor, id: string, action: string, before: number, after: number) {
		await tx.insert(gameLogs).values({ discordId: id, action, previousCredux: before, updatedCredux: after });
	}
}
