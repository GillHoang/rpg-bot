import { REST, Routes } from 'discord.js';
import { CommandRegistry } from '../core/CommandRegistry.js';
import { registerAllCommands } from '../core/registerAllCommands.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Đăng ký slash command lên Discord API.
 *
 * - `pnpm deploy:commands` → global, KHÔNG kèm lệnh admin (/test).
 * - `pnpm deploy:commands -- --guild <guildId>` → chỉ trong 1 server thử
 *   nghiệm, đăng ký TOÀN BỘ lệnh kể cả /test để dev không phải chờ cache
 *   global (cập nhật tức thì, không ảnh hưởng người chơi thật).
 */
const COMMAND_NAME_DEV_ONLY = 'test';

function guildIdFromArgv(): string | null {
	const args = process.argv.slice(2);
	const inline = args.find((a) => a.startsWith('--guild='));
	if (inline) return inline.split('=')[1] || null;
	const index = args.indexOf('--guild');
	if (index !== -1) return args[index + 1] ?? null;
	return null;
}

// Same single source of truth as the bot runtime — one list, two consumers.
registerAllCommands();
const registry = CommandRegistry.getInstance();
const guildId = guildIdFromArgv();

try {
	const body = registry
		.getAll()
		.filter((c) => guildId !== null || c.data.name !== COMMAND_NAME_DEV_ONLY)
		.map((c) => c.data.toJSON());
	const rest = new REST().setToken(env.DISCORD_TOKEN);

	if (guildId) {
		await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body });
		logger.info(`Deployed ${body.length} command(s) to guild ${guildId}.`);
	} else {
		await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
		logger.info(`Deployed ${body.length} global slash command(s).`);
	}
} catch (error) {
	logger.error({ err: error }, 'Failed to deploy commands');
	process.exit(1);
}
