import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './helpers/database.js';
import * as s from '../src/db/schema.js';
import { MAX_COMBAT_LEVEL } from '../src/config/combatExp.js';

it('upgrades populated EXP columns and level limits without losing existing progress', async () => {
	const { db, testClient } = createTestDatabase();
	const root = new URL('../src/db/migrations/', import.meta.url);
	try {
		for (const tag of ['0000_nasty_molecule_man', '0001_dazzling_maelstrom', '0002_audit_integrity']) {
			await testClient.exec(await readFile(new URL(`${tag}.sql`, root), 'utf8'));
		}
		await db.insert(s.users).values({ discordId: 'migration', username: 'Migration' });
		await db
			.insert(s.userCharacter)
			.values({
				discordId: 'migration',
				class: 'Knight',
				combatLevel: 50,
				combatExp: 1000,
				lifetimeExp: 2_000_000_000,
			});
		await db
			.insert(s.raidLogs)
			.values({
				discordId: 'migration',
				battleType: 'raid',
				enemyName: 'mob',
				enemyTier: 'regular',
				result: 'win',
				updatedExp: 1000,
				updatedBeliefShards: 0,
				updatedCredux: 0,
			});
		await testClient.exec(await readFile(new URL('0003_combat_progression.sql', root), 'utf8'));
		const [preserved] = await db.select().from(s.userCharacter);
		expect(preserved).toMatchObject({ combatLevel: 50, combatExp: 1000, lifetimeExp: 2_000_000_000 });
		expect((await db.select().from(s.raidLogs))[0].updatedExp).toBe(1000);
		await db
			.update(s.userCharacter)
			.set({ combatLevel: MAX_COMBAT_LEVEL, lifetimeExp: 3_630_601_650 })
			.where(eq(s.userCharacter.discordId, 'migration'));
		expect((await db.select().from(s.userCharacter))[0]).toMatchObject({
			combatLevel: MAX_COMBAT_LEVEL,
			lifetimeExp: 3_630_601_650,
		});
		await expect(
			db
				.update(s.userCharacter)
				.set({ combatLevel: MAX_COMBAT_LEVEL + 1 })
				.where(eq(s.userCharacter.discordId, 'migration')),
		).rejects.toThrow();
	} finally {
		await testClient.close();
	}
}, 30000);
