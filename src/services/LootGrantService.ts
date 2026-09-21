import { randomUUID } from 'node:crypto';
import type { Executor } from '../db/client.js';
import { choose, GEAR_STATS } from '../config/chestLoot.js';
import { randInt } from '../config/raidLoot.js';
import { LootRepository } from '../repositories/LootRepository.js';

/** Rolls and grants loot using the caller's transaction and per-action RNG. */
export class LootGrantService {
	constructor(
		private readonly repo: Pick<
			LootRepository,
			'findRunePool' | 'insertRune' | 'findWeaponPool' | 'insertWeapon' | 'findArmorPool' | 'insertArmor'
		> = new LootRepository(),
	) {}
	async rune(tx: Executor, id: string, rng: () => number, filter: { tier?: string; names?: string[] }) {
		const pool = await this.repo.findRunePool(tx, filter);
		if (filter.names?.some((name) => !pool.some((r) => r.name === name)))
			throw new Error('Thiếu rune trong seed shop.');
		const rune = choose(pool, rng);
		const runeUid = `r_${randomUUID()}`;
		await this.repo.insertRune(tx, { discordId: id, runeUid, runeId: rune.runeId });
		return `${rune.name} (${rune.tier}) · ID: ${runeUid}`;
	}

	async gear(tx: Executor, id: string, tier: keyof typeof GEAR_STATS, rng: () => number) {
		const stats = GEAR_STATS[tier];
		const kind = choose(['weapon', 'armor'] as const, rng);
		const uid = `${kind === 'weapon' ? 'w' : 'a'}_${randomUUID()}`;
		if (kind === 'weapon') {
			const row = choose(await this.repo.findWeaponPool(tx, tier), rng);
			const atk = randInt(rng, stats.atk);
			await this.repo.insertWeapon(tx, {
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
		const row = choose(await this.repo.findArmorPool(tx, tier), rng);
		const hp = randInt(rng, stats.hp),
			def = randInt(rng, stats.def);
		await this.repo.insertArmor(tx, {
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
}
