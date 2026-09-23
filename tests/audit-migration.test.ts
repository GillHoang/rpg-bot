import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const db = new PGlite();
const migration = (name: string) => readFile(new URL('../src/db/migrations/' + name, import.meta.url), 'utf8');
beforeAll(async () => {
	await db.exec(await migration('0000_nasty_molecule_man.sql'));
	await db.exec(await migration('0001_dazzling_maelstrom.sql'));
	await db.exec(`INSERT INTO users(discord_id,username) VALUES ('old','Old');
 INSERT INTO users_bag(discord_id) VALUES ('old');
 INSERT INTO user_character(discord_id,class,last_weekly_claim_week) VALUES ('old','Knight',1);
 INSERT INTO user_presets(id,discord_id,slot) VALUES (99,'old',1);
 INSERT INTO weekly_quests(discord_id,quest_type,target_count,reward_credux,reward_valor,quest_week) VALUES ('old','summon',10,100,1,1);
 INSERT INTO weekly_grand(discord_id,quest_week,claimed) VALUES ('old',1,true);`);
}, 30000);
afterAll(() => db.close());
it('migrates existing IDs and preserves ambiguous week history without inventing a year', async () => {
	await db.exec('BEGIN');
	await db.exec(await migration('0002_audit_integrity.sql'));
	await db.exec('COMMIT');
	expect((await db.query<{ quest_week: string }>('SELECT quest_week FROM weekly_quests')).rows[0].quest_week).toBe(
		'legacy-W1',
	);
	expect((await db.query<{ quest_week: string }>('SELECT quest_week FROM weekly_grand')).rows[0].quest_week).toBe(
		'legacy-W1',
	);
	expect(
		(await db.query<{ last_weekly_claim_week: string }>('SELECT last_weekly_claim_week FROM user_character'))
			.rows[0].last_weekly_claim_week,
	).toBe('legacy-W1');
	const inserted = await db.query<{ id: number }>(
		"INSERT INTO user_presets(discord_id,slot) VALUES ('old',2) RETURNING id",
	);
	expect(inserted.rows[0].id).toBe(100);
	await db.exec(
		"INSERT INTO weekly_grand(discord_id,quest_week,claimed) VALUES ('old','2026-W01',true), ('old','2027-W01',true)",
	);
	expect((await db.query('SELECT * FROM weekly_grand')).rows).toHaveLength(3);
});
it('rejects negative currency, invalid classes, invalid slots and duplicate active seasons', async () => {
	await expect(db.exec('UPDATE users_bag SET credux=-1')).rejects.toThrow();
	await expect(db.exec("UPDATE user_character SET class='Unknown'")).rejects.toThrow();
	await expect(db.exec('UPDATE user_character SET active_preset_slot=3')).rejects.toThrow();
	await expect(db.exec('UPDATE user_presets SET slot=3 WHERE id=100')).rejects.toThrow();
	await db.exec("INSERT INTO seasons(name,starts_at,ends_at,is_active) VALUES ('S1','2026-01-01','2026-02-01',true)");
	await expect(
		db.exec("INSERT INTO seasons(name,starts_at,ends_at,is_active) VALUES ('S2','2026-01-01','2026-02-01',true)"),
	).rejects.toThrow();
});
