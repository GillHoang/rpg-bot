import { eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { mobRoster } from '../db/schema.js';

export interface MonsterStats {
	name: string;
	hp: number;
	atk: number;
	def: number;
	crit: number;
}

export class MonsterRepository {
	/**
	 * Picks one random "regular" mob and scales its stats to the given
	 * player level. Formula fixed to match statAssembly.js's C1 rule:
	 * base + per_level * level (NOT level - 1 — mobs scale differently
	 * from player classes, which do use level - 1 steps).
	 */
	async pickRandomRegularForLevel(executor: Executor, level: number): Promise<MonsterStats | null> {
		const [row] = await executor
			.select()
			.from(mobRoster)
			.where(eq(mobRoster.mobType, 'regular'))
			.orderBy(sql`RANDOM()`)
			.limit(1);
		if (!row) return null;

		const lv = Math.max(1, level);
		return {
			name: row.name,
			hp: row.baseHp + row.hpPerLevel * lv,
			atk: row.baseAtk + row.atkPerLevel * lv,
			def: row.baseDef + row.defPerLevel * lv,
			crit: row.baseCrit,
		};
	}
}
