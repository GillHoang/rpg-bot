import { eq, inArray } from 'drizzle-orm';
import { pick } from '../utils/weightedRandom.js';
import { choose } from '../config/chestLoot.js';
import type { Executor } from '../db/client.js';
import { mobRoster } from '../db/schema.js';

export interface MonsterStats {
	name: string;
	hp: number;
	atk: number;
	def: number;
	crit: number;
	mobType: string;
	skillKey: string;
	immunityTags: string[];
}

export class MonsterRepository {
	/**
	 * Picks a weighted regular/elite encounter, or Bakunawa, and scales to the given
	 * player level. Formula fixed to match statAssembly.js's C1 rule:
	 * base + per_level * level (NOT level - 1 — mobs scale differently
	 * from player classes, which do use level - 1 steps).
	 */
	async pickForLevel(
		executor: Executor,
		level: number,
		rng: () => number,
		boss = false,
	): Promise<MonsterStats | null> {
		const rows = await executor
			.select()
			.from(mobRoster)
			.where(boss ? eq(mobRoster.skillKey, 'moon_threshold') : inArray(mobRoster.mobType, ['regular', 'elite']))
			.orderBy(mobRoster.mobId);
		if (!rows.length) return null;
		const type = boss
			? 'boss'
			: pick(
					[
						{ original: 'regular', weight: 80 },
						{ original: 'elite', weight: 20 },
					].filter((t) => rows.some((r) => r.mobType === t.original)),
					{ next: rng },
				);
		const pool = rows.filter((r) => r.mobType === type);
		if (!pool.length) return null;
		const row = choose(pool, rng);

		const lv = Math.max(1, level);
		return {
			name: row.name,
			hp: row.baseHp + row.hpPerLevel * lv,
			atk: row.baseAtk + row.atkPerLevel * lv,
			def: row.baseDef + row.defPerLevel * lv,
			crit: row.baseCrit,
			mobType: row.mobType,
			skillKey: row.skillKey,
			immunityTags: Array.isArray(row.immunityTags) ? row.immunityTags : [],
		};
	}
}
