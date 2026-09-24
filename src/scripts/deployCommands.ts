import { DEPLOY_COMMANDS_LOG_TEXT } from '../shared/ui/text/diagnostics.js';
import { REST, Routes } from 'discord.js';
import { CommandRegistry } from '../app/CommandRegistry.js';
import { createAppContainer } from '../app/container.js';
import { EventBus } from '../shared/kernel/EventBus.js';
import { registerAllCommands } from '../app/registerAllCommands.js';
import { env } from '../shared/config/env.js';
import { logger, flushErrorWebhook } from '../shared/utils/logger.js';
import { parseCommandScope } from './commandScope.js';

/**
 * Đăng ký slash command lên Discord API.
 *
 * - `pnpm deploy:commands` → global, KHÔNG kèm lệnh admin (/test).
 * - `pnpm deploy:commands -- --guild <guildId>` → chỉ trong 1 server thử
 *   nghiệm, đăng ký TOÀN BỘ lệnh kể cả /test để dev không phải chờ cache
 *   global (cập nhật tức thì, không ảnh hưởng người chơi thật).
 *   Thiếu guildId → DỪNG với lỗi, tuyệt đối không rơi sang nhánh global
 *   (global deploy là thao tác ảnh hưởng toàn bộ người chơi).
 * - `DEPLOY_GUILD_ID=<guildId> pnpm deploy:commands` → guild deploy không
 *   cần cờ (hữu ích trên VPS thử nghiệm).
 */
const COMMAND_NAME_DEV_ONLY = 'test';

try {
	const { guildId } = parseCommandScope(process.argv.slice(2), env.DEPLOY_GUILD_ID);
	const registry = new CommandRegistry();
	// Explicit container: only command metadata (.data) is read below, but
	// commands take injected services, so a real (I/O-free at build time)
	// graph is still required. Needs the full env, including DATABASE_URL.
	registerAllCommands(createAppContainer({ events: new EventBus() }), registry);
	const body = registry
		.getAll()
		.filter((c) => guildId !== null || c.data.name !== COMMAND_NAME_DEV_ONLY)
		.map((c) => c.data.toJSON());
	const rest = new REST().setToken(env.DISCORD_TOKEN);

	if (guildId) {
		await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body });
		logger.info(DEPLOY_COMMANDS_LOG_TEXT.guildDeployed(body.length, guildId));
	} else {
		await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
		logger.info(DEPLOY_COMMANDS_LOG_TEXT.globalDeployed(body.length));
	}
} catch (error) {
	logger.error({ err: error }, DEPLOY_COMMANDS_LOG_TEXT.failed);
	await flushErrorWebhook();
	process.exit(1);
}
