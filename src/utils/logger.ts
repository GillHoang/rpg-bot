import pino from 'pino';
import { env } from '../config/env.js';
import { WebhookClient } from 'discord.js';
import { ErrorWebhook } from './errorWebhook.js';

const client = env.ERROR_WEBHOOK_URL
	? new WebhookClient({ url: env.ERROR_WEBHOOK_URL }, { rest: { timeout: 5000, retries: 0 } })
	: undefined;
const webhook = client
	? new ErrorWebhook(
			(payload) => client.send(payload),
			[env.DISCORD_TOKEN, env.DATABASE_URL, env.ERROR_WEBHOOK_URL ?? ''],
		)
	: undefined;

export async function flushErrorWebhook(): Promise<void> {
	await webhook?.flush();
}

export const logger = pino({
	level: env.LOG_LEVEL,
	serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err },
	hooks: {
		streamWrite(line) {
			webhook?.write(line);
			return line;
		},
	},
	transport:
		process.env.NODE_ENV === 'production'
			? undefined
			: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
