import { ENV_ERROR_TEXT } from '../ui/text/diagnostics.js';
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
	DISCORD_TOKEN: z.string().min(1, ENV_ERROR_TEXT.discordTokenRequired),
	DISCORD_CLIENT_ID: z.string().min(1, ENV_ERROR_TEXT.clientIdRequired),
	DATABASE_URL: z.string().min(1, ENV_ERROR_TEXT.databaseUrlRequired),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
	ERROR_WEBHOOK_URL: z.preprocess(
		(value) => (value === '' ? undefined : value),
		z
			.string()
			.regex(
				/^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+$/,
				ENV_ERROR_TEXT.invalidWebhook,
			)
			.optional(),
	),
	/** Discord ID được phép dùng /reset — bắt buộc để lệnh này hoạt động. */
	OWNER_DISCORD_IDS: z
		.string()
		.min(1, ENV_ERROR_TEXT.ownersRequired)
		.transform((s) =>
			s
				.split(',')
				.map((id) => id.trim())
				.filter((id) => /^\d+$/.test(id)),
		)
		.refine((ids) => ids.length > 0, ENV_ERROR_TEXT.invalidOwners),
	/** Ghi đè guild deploy khi chạy `deploy:commands` trên server thử nghiệm (tuỳ chọn). */
	DEPLOY_GUILD_ID: z.string().regex(/^\d+$/, ENV_ERROR_TEXT.invalidGuild).optional(),
	/** Giãn cách hunt raid (giây) — server test có thể hạ để test nhanh (mặc định 15). */
	HUNT_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(15),
	/** Lockout boss dạng lăn (phút) — 0 giữ luật 1 lượt/ngày lịch VN; >0 thay bằng cửa sổ lăn (cho server test). */
	BOSS_COOLDOWN_MINUTES: z.coerce.number().int().min(0).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	// Fail fast: a bot with bad config should never half-start.
	console.error(ENV_ERROR_TEXT.invalidConfiguration, parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;
