import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { createTestDatabase } from './helpers/database.js';
import * as s from '../src/db/schema.js';

it('backfills mode records and streaks across interleaved logs, preserving legacy totals', async () => {
	const { db, testClient } = createTestDatabase();
	const root = new URL('../src/db/migrations/', import.meta.url);
	try {
		for (const tag of [
			'0000_nasty_molecule_man',
			'0001_dazzling_maelstrom',
			'0002_audit_integrity',
			'0003_combat_progression',
		]) {
			await testClient.exec(await readFile(new URL(`${tag}.sql`, root), 'utf8'));
		}
		await testClient.exec(`
			INSERT INTO users (discord_id, username) VALUES ('a', 'A'), ('b', 'B'), ('legacy', 'Legacy');
			INSERT INTO user_character (discord_id, class, pvp_wins, pvp_losses, highest_rank_streak)
			VALUES ('a', 'Knight', 100, 50, 0), ('b', 'Knight', 20, 30, 0), ('legacy', 'Knight', 7, 4, 9);
			INSERT INTO pvp_logs (id, challenger_id, opponent_id, winner_id, challenger_damage, opponent_damage)
			VALUES (1, 'a', 'b', 'a', 10, 5), (2, 'c', 'd', 'c', 10, 5),
				(3, 'b', 'a', 'a', 5, 10), (4, 'a', 'b', 'b', 5, 10), (5, 'a', 'b', 'a', 10, 5);
			INSERT INTO ranked_logs (id, player_id, opponent_id, result, rating_before, rating_after)
			VALUES (1, 'a', 'b', 'win', 1000, 1016), (2, 'b', 'a', 'loss', 1000, 984),
				(3, 'a', 'b', 'win', 1016, 1031), (4, 'b', 'a', 'loss', 984, 969),
				(5, 'a', 'b', 'loss', 1031, 1014), (6, 'a', 'b', 'win', 1014, 1030),
				(7, 'a', 'b', 'draw', 1030, 1030), (8, 'a', 'b', 'win', 1030, 1046);
		`);
		await testClient.exec(await readFile(new URL('0004_battle_standardization.sql', root), 'utf8'));
		const characters = await db.select().from(s.userCharacter);
		expect(characters.find((row) => row.discordId === 'a')).toMatchObject({
			duelWins: 3,
			duelLosses: 1,
			highestDuelStreak: 2,
			rankedWins: 4,
			rankedLosses: 1,
			highestRankStreak: 2,
			pvpWins: 100,
			pvpLosses: 50,
		});
		expect(characters.find((row) => row.discordId === 'b')).toMatchObject({
			duelWins: 1,
			duelLosses: 3,
			highestDuelStreak: 1,
			rankedWins: 0,
			rankedLosses: 2,
		});
		expect(characters.find((row) => row.discordId === 'legacy')).toMatchObject({
			duelWins: 0,
			duelLosses: 0,
			rankedWins: 0,
			rankedLosses: 0,
			pvpWins: 7,
			pvpLosses: 4,
			highestRankStreak: 9,
		});
		expect((await db.select().from(s.pvpLogs).orderBy(s.pvpLogs.id)).map((row) => row.outcome)).toEqual([
			'win',
			'win',
			'loss',
			'loss',
			'win',
		]);
		await db.insert(s.pvpLogs).values({
			id: 100,
			challengerId: 'a',
			opponentId: 'b',
			winnerId: null,
			outcome: 'draw',
			challengerDamage: 0,
			opponentDamage: 0,
		});
		await db.insert(s.huntCooldowns).values({ discordId: 'legacy', readyAt: new Date() });
		await testClient.exec("DELETE FROM users WHERE discord_id = 'legacy'");
		expect(await db.select().from(s.huntCooldowns)).toHaveLength(0);
		await expect(
			db.insert(s.huntCooldowns).values({ discordId: 'missing', readyAt: new Date() }),
		).rejects.toThrow();
	} finally {
		await testClient.close();
	}
}, 30000);
