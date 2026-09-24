import { eq, inArray } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { mobRoster } from '../../../db/schema.js';

export type MonsterRosterRow = typeof mobRoster.$inferSelect;

/** Reads the ordered roster; encounter selection and scaling belong to the service. */
export class MonsterRosterRepository {
	async listForEncounter(executor: Executor, boss: boolean): Promise<MonsterRosterRow[]> {
		return executor
			.select()
			.from(mobRoster)
			.where(boss ? eq(mobRoster.skillKey, 'moon_threshold') : inArray(mobRoster.mobType, ['regular', 'elite']))
			.orderBy(mobRoster.mobId);
	}
}
