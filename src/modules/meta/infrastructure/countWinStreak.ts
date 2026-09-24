import { and, eq, gt, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Executor } from '../../../db/client.js';

/** Count all wins after the last non-win without fetching an unbounded history. */
export async function countWinStreak(
	executor: Executor,
	history: { table: PgTable; id: AnyPgColumn; player: AnyPgColumn; result: AnyPgColumn },
	discordId: string,
): Promise<number> {
	const { table, id, player, result } = history;
	const lastNonWin = sql`coalesce((select max(${id}) from ${table} where ${player} = ${discordId} and ${result} <> 'win'), 0)`;
	const [row] = await executor
		.select({ count: sql<number>`count(*)::integer` })
		.from(table)
		.where(and(eq(player, discordId), eq(result, 'win'), gt(id, lastNonWin)));
	return row?.count ?? 0;
}
