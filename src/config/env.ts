import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
	DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
	DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
		DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	// Fail fast: a bot with bad config should never half-start.
	console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;
