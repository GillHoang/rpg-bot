import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { createTestDatabase } from './helpers/database.js';
import * as s from '../src/db/schema.js';
import { MAX_COMBAT_LEVEL } from '../src/shared/config/combatExp.js';

it('upgrades populated EXP columns and level limits without losing existing progress', async () => {
	const { db, testClient } = createTestDatabase();
	const root = new URL('../src/db/migrations/', import.meta.url);
	try {
		for (const tag of ['0000_nasty_molecule_man', '0001_dazzling_maelstrom', '0002_audit_integrity']) {
			await testClient.exec(await readFile(new URL(`${tag}.sql`, root), 'utf8'));
		}
		await db.insert(s.users).values({ discordId: 'migration', username: 'Migration' });
		await testClient.exec(
			`INSERT INTO user_character (discord_id, class, combat_level, combat_exp, lifetime_exp)
			 VALUES ('migration', 'Knight', 50, 1000, 2000000000);`,
		);
		await testClient.exec(
			`INSERT INTO raid_logs (discord_id, battle_type, enemy_name, enemy_tier, result, updated_exp, updated_belief_shards, updated_credux)
			 VALUES ('migration', 'raid', 'mob', 'regular', 'win', 1000, 0, 0);`,
		);
		await testClient.exec(await readFile(new URL('0003_combat_progression.sql', root), 'utf8'));
		await testClient.exec(await readFile(new URL('0004_battle_standardization.sql', root), 'utf8'));
		await testClient.exec(await readFile(new URL('0005_portal_progression.sql', root), 'utf8'));
		await testClient.exec(await readFile(new URL('0006_portal_gates.sql', root), 'utf8'));
		// Later additive migrations (new columns only) so drizzle's current
		// schema can read the rows back; the assertions below are unaffected.
		for (const tag of [
			'0007_ranked_log_timezone',
			'0008_bigint-credux-headroom',
			'0009_ranked-log-initiator',
			'0010_pvp-timestamps-tz',
			'0011_weapon-owo-parity',
			'0012_weapon-deity-attach',
			'0013_skill-loadout',
			'0014_gear-sets',
			'0015_tower-progress',
			'0016_worldboss-attacks',
			'0017_season-claim',
		]) {
			await testClient.exec(await readFile(new URL(`${tag}.sql`, root), 'utf8'));
		}
		const [preserved] = await db.select().from(s.userCharacter);
		expect(preserved.gate1TiersCleared).toBe(0);
		expect(getTableConfig(s.userCharacter).checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining(['gate1_tiers_valid', 'gate5_tiers_valid']),
		);
		await expect(
			db
				.update(s.userCharacter)
				.set({ gate1TiersCleared: 11 })
				.where(eq(s.userCharacter.discordId, 'migration')),
		).rejects.toThrow();
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
}, 120000);
