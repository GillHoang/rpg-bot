import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * XOÁ SẠCH mọi slash command đã đăng ký của application — global lẫn guild.
 *
 *   pnpm undeploy:commands                       → chỉ xóa global
 *   pnpm undeploy:commands -- --guild <guildId>  → xóa thêm cả guild chỉ định
 *   DEPLOY_GUILD_ID=... pnpm undeploy:commands   → guild lấy từ env (nếu có)
 *
 * Mục đích: dọn cache lệnh cũ/lệch sau khi đổi tên, gỡ lệnh, hoặc trước khi
 * deploy lại bộ lệnh sạch. Không cần đăng ký gì cả — chỉ gọi DELETE lên
 * Discord API. Lệnh /help và mọi lệnh khác sẽ MẤT cho tới khi chạy lại
 * `deploy:commands` (hoặc khởi động lại bot — entrypoint tự deploy).
 */
const guildIdFromArgv = (): string | null => {
	const args = process.argv.slice(2);
	const inline = args.find((a) => a.startsWith('--guild='));
	if (inline) return inline.split('=')[1] || null;
	const index = args.indexOf('--guild');
	if (index !== -1) return args[index + 1] ?? null;
	return null;
};

const flagGuildId = guildIdFromArgv();
// Giống deployCommands: --guild kèm giá trị rác → dừng, không động vào global.
if (flagGuildId !== null && !/^\d+$/.test(flagGuildId)) {
	logger.error('--guild needs a numeric guild ID (e.g. pnpm undeploy:commands -- --guild 1234567890) — aborting.');
	process.exit(1);
}
const guildId = flagGuildId ?? env.DEPLOY_GUILD_ID ?? null;

try {
	const rest = new REST().setToken(env.DISCORD_TOKEN);

	// PUT với body rỗng = xoá toàn bộ lệnh của scope tương ứng.
	await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: [] });
	logger.info('Global slash commands cleared.');

	if (guildId) {
		await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body: [] });
		logger.info(`Guild ${guildId} slash commands cleared.`);
	}
	process.exit(0);
} catch (error) {
	logger.error({ err: error }, 'Failed to clear slash commands');
	process.exit(1);
}
