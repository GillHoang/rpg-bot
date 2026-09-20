import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

export type ResetResult =
	| { status: 'ok'; deletedUsers: number }
	| { status: 'nothing-to-reset' };

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
 * "Reset full data": xoá TOÀN BỘ dữ liệu người chơi + log gameplay, giữ lại
 * catalog seed và cấu hình server. users là gốc của mọi FK dữ liệu người
 * chơi — một lệnh `TRUNCATE users CASCADE` dọn hết bảng con (bag, character,
 * gear, runes, quests, sessions, supporters...). Các bảng log/giao dịch còn
 * lại được dọn tường minh trong cùng một lệnh TRUNCATE.
 *
 * RESTART IDENTITY cho các ID tự tăng bắt đầu lại từ 1 — data sạch hoàn toàn
 * như lúc mới migrate. TRUNCATE không thể rollback bên trong transaction có
 * lỗi, nhưng đây chính là thao tác "xoá sạch có chủ đích".
 */
export class ResetService {
	async resetAll(): Promise<ResetResult> {
		const [{ count }] = await db.execute<{ count: number }>(
			sql`SELECT count(*)::int AS count FROM users`,
		).then((r) => r.rows as { count: number }[]);
		if (count === 0) return { status: 'nothing-to-reset' };

		await db.execute(
			sql.raw(
				`TRUNCATE TABLE users, ${LOG_TABLES.join(', ')} RESTART IDENTITY CASCADE;`,
			),
		);
		return { status: 'ok', deletedUsers: count };
	}

	/** Ghi dấu vết reset vào dev_logs (bảng này được chủ đích giữ lại). */
	async audit(devId: string, deletedUsers: number): Promise<void> {
		const detail = `reset ${deletedUsers} users`;
		await db.execute(
			sql`INSERT INTO dev_logs (dev_id, action_type, target_discord_id, amount_or_detail)
				VALUES (${devId}, 'reset_full', ${devId}, ${detail})`,
		);
	}
}
