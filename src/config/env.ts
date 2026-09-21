import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
	DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
	DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
	DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
	ERROR_WEBHOOK_URL: z.preprocess(
		(value) => (value === '' ? undefined : value),
		z
			.string()
			.regex(
				/^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+$/,
				'Expected a Discord webhook URL',
			)
			.optional(),
	),
	/** Discord ID được phép dùng /reset — bắt buộc để lệnh này hoạt động. */
	OWNER_DISCORD_IDS: z
		.string()
		.min(1, 'OWNER_DISCORD_IDS is required (comma-separated Discord user IDs)')
		.transform((s) =>
			s
				.split(',')
				.map((id) => id.trim())
				.filter((id) => /^\d+$/.test(id)),
		)
		.refine((ids) => ids.length > 0, 'OWNER_DISCORD_IDS must contain at least one numeric Discord ID'),
	/** Ghi đè guild deploy khi chạy `deploy:commands` trên server thử nghiệm (tuỳ chọn). */
	DEPLOY_GUILD_ID: z.string().regex(/^\d+$/, 'DEPLOY_GUILD_ID must be a numeric guild ID').optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	// Fail fast: a bot with bad config should never half-start.
	console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;
