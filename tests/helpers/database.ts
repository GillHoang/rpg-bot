import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/db/schema.js';

/** Call inside each suite's vi.mock factory so databases never share state. */
export function createTestDatabase() {
	const testClient = new PGlite();
	return {
		db: drizzle(testClient, { schema }),
		pool: { end: () => testClient.close() },
		testClient,
	};
}

export type TestDatabase = ReturnType<typeof createTestDatabase>;

/** Apply every checked-in migration in the same order as production. */
export async function migrateTestDatabase(testClient: PGlite): Promise<void> {
	const migrations = new URL('../../src/db/migrations/', import.meta.url);
	const journal = JSON.parse(
		await readFile(new URL('meta/_journal.json', migrations), 'utf8'),
	) as { entries: { tag: string }[] };

	for (const { tag } of journal.entries) {
		await testClient.exec(await readFile(new URL(`${tag}.sql`, migrations), 'utf8'));
	}
}
