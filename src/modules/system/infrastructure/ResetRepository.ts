import { sql } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';

/** Bảng KHÔNG bị reset — xoá là mất cấu hình bot / ledger đối soát. */
const KEEP_TABLES = new Set(['server_config', 'stripe_events', 'dev_logs']);

/**
 * Bảng log/giao dịch không có FK về `users` (hoặc không cascade) — dọn
 * tường minh sau TRUNCATE users CASCADE. Bảng catalog seed (roster,
 * cosmetic/title catalog, ranked_reward, socket_unlock_cost,
 * essence_bag_def) không nằm ở đây: reset giữ nguyên dữ liệu seed.
 */
const LOG_TABLES = [
	'active_battles',
	'active_ranked_fights',
	'auto_raids',
	'boss_attack_log',
	'boss_spawn_queue',
	'boss_state',
	'casino_logs',
	'game_logs',
	'pvp_logs',
	'pvp_shop_purchases',
	'raid_logs',
	'raid_reward_daily_totals',
	'raid_reward_grants',
	'ranked_logs',
	'seasons',
	'summon_reward_grants',
	'topgg_vote_events',
].filter((t) => !KEEP_TABLES.has(t));

/**
 * Mọi bảng có cột `discord_id` — một user bị xoá khỏi tất cả các bảng này.
 * Thứ tự: log/session/con trước, `users` cuối cùng để không vỡ FK.
 */
const USER_TABLES = [
	'active_battles',
	'active_casino_sessions',
	'active_duel_participants',
	'active_ranked_fights',
	'auto_raids',
	'boss_attack_log',
	'casino_logs',
	'daily_quest_completion_rewards',
	'daily_quests',
	'equipped_skins',
	'essence_exchange_submissions',
	'game_logs',
	'hunt_cooldowns',
	'menu_action_receipts',
	'pity_counters',
	'pvp_shop_purchases',
	'raid_logs',
	'raid_reward_daily_totals',
	'raid_reward_grants',
	'summon_reward_grants',
	'supporter_grants',
	'supporter_item_grants',
	'supporter_token_ledger',
	'supporters',
	'topgg_vote_events',
	'user_armors',
	'user_cosmetics',
	'user_deities',
	'user_guild_activity',
	'user_presets',
	'user_runes',
	'user_titles',
	'user_weapons',
	'weekly_grand',
	'weekly_quests',
	'user_character',
	'users_bag',
	'users',
];

/** Explicit persistence operations for the separately confirmed administrator reset. */
export class ResetRepository {
	async lockUsers(tx: Executor): Promise<void> {
		await tx.execute(sql`LOCK TABLE users_bag, users IN ACCESS EXCLUSIVE MODE`);
	}
	async countUsers(tx: Executor): Promise<number> {
		const [{ count }] = await tx
			.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM users`)
			.then((r) => r.rows as { count: number }[]);
		return count ?? 0;
	}
	async truncatePlayerData(tx: Executor): Promise<void> {
		await tx.execute(sql.raw(`TRUNCATE TABLE users, ${LOG_TABLES.join(', ')} RESTART IDENTITY CASCADE;`));
	}
	async insertAudit(tx: Executor, devId: string, detail: string): Promise<void> {
		await tx.execute(sql`INSERT INTO dev_logs (dev_id, action_type, target_discord_id, amount_or_detail)
VALUES (${devId}, 'reset_full', ${devId}, ${detail})`);
	}
	async insertUserAudit(tx: Executor, devId: string, targetId: string, detail: string): Promise<void> {
		await tx.execute(sql`INSERT INTO dev_logs (dev_id, action_type, target_discord_id, amount_or_detail)
VALUES (${devId}, 'reset_user', ${targetId}, ${detail})`);
	}
	/** Tổng số row của một user trên mọi bảng — preview trước khi xoá, không đụng data. */
	async countUserData(executor: Executor, discordId: string): Promise<number> {
		let total = 0;
		for (const table of USER_TABLES) {
			const [{ count }] = await executor
				.execute<{ count: number }>(
					sql`SELECT count(*)::int AS count FROM ${sql.identifier(table)} WHERE discord_id = ${discordId}`,
				)
				.then((r) => r.rows as { count: number }[]);
			total += count ?? 0;
		}
		const [{ count }] = await executor
			.execute<{ count: number }>(
				sql`SELECT count(*)::int AS count FROM "pvp_logs" WHERE challenger_id = ${discordId} OR opponent_id = ${discordId} OR winner_id = ${discordId}`,
			)
			.then((r) => r.rows as { count: number }[]);
		total += count ?? 0;
		const [{ count: wager }] = await executor
			.execute<{ count: number }>(
				sql`SELECT count(*)::int AS count FROM "wager_logs" WHERE challenger_id = ${discordId} OR opponent_id = ${discordId} OR winner_id = ${discordId}`,
			)
			.then((r) => r.rows as { count: number }[]);
		total += wager ?? 0;
		const [{ count: ranked }] = await executor
			.execute<{ count: number }>(
				sql`SELECT count(*)::int AS count FROM "ranked_logs" WHERE player_id = ${discordId} OR opponent_id = ${discordId}`,
			)
			.then((r) => r.rows as { count: number }[]);
		total += ranked ?? 0;
		// active_duels has no discord_id column — count by either seat.
		const [{ count: duels }] = await executor
			.execute<{ count: number }>(
				sql`SELECT count(*)::int AS count FROM "active_duels" WHERE challenger_id = ${discordId} OR opponent_id = ${discordId}`,
			)
			.then((r) => r.rows as { count: number }[]);
		return total + (duels ?? 0);
	}
	/** Xoá toàn bộ dữ liệu một user trong đúng 1 transaction — FK lỗi là rollback hết. */
	async deleteUserData(tx: Executor, discordId: string): Promise<number> {
		let total = 0;
		for (const table of USER_TABLES) {
			const res = await tx.execute(
				sql`DELETE FROM ${sql.identifier(table)} WHERE discord_id = ${discordId}`,
			);
			total += (res as unknown as { rowCount?: number }).rowCount ?? 0;
		}
		const pvp = await tx.execute(
			sql`DELETE FROM "pvp_logs" WHERE challenger_id = ${discordId} OR opponent_id = ${discordId} OR winner_id = ${discordId}`,
		);
		total += (pvp as unknown as { rowCount?: number }).rowCount ?? 0;
		const wager = await tx.execute(
			sql`DELETE FROM "wager_logs" WHERE challenger_id = ${discordId} OR opponent_id = ${discordId} OR winner_id = ${discordId}`,
		);
		total += (wager as unknown as { rowCount?: number }).rowCount ?? 0;
		const ranked = await tx.execute(
			sql`DELETE FROM "ranked_logs" WHERE player_id = ${discordId} OR opponent_id = ${discordId}`,
		);
		total += (ranked as unknown as { rowCount?: number }).rowCount ?? 0;
		// active_duels rows reference the user by seat, not discord_id — without
		// this the opponent would keep an Accept button on a deleted duel.
		// Runs after active_duel_participants (deleted in the loop above).
		const duels = await tx.execute(
			sql`DELETE FROM "active_duels" WHERE challenger_id = ${discordId} OR opponent_id = ${discordId}`,
		);
		total += (duels as unknown as { rowCount?: number }).rowCount ?? 0;
		return total;
	}
}
