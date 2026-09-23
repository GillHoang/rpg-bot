import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client.js';

/** Bảng KHÔNG bị reset — xoá là mất cấu hình bot / ledger đối soát. */
const KEEP_TABLES = new Set([
	'server_config',
	'stripe_events',
	'dev_logs',
	// Donation orders and provider receipts are financial audit history. They
	// deliberately do not reference users, so TRUNCATE users CASCADE cannot
	// remove them during the gameplay reset.
	'donation_orders',
	'donation_webhook_receipts',
	'donation_provisioning_jobs',
	'donation_grant_receipts',
]);

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
}
