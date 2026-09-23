import { ENV_ERROR_TEXT } from '../text/diagnostics.js';
import { z } from 'zod';
import 'dotenv/config';

const optionalEnvString = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());

const optionalPositiveInt = z.preprocess(
	(value) => (value === '' || value === undefined ? undefined : value),
	z.coerce.number().int().positive().optional(),
);

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
	/** Donation is fail-closed until the operator provides all provider settings. */
	SUPPORTER_DONATIONS_ENABLED: z
		.preprocess((value) => (value === '' ? undefined : value), z.enum(['true', 'false']).default('false'))
		.transform((value) => value === 'true'),
	SUPPORTER_TIERS_JSON: optionalEnvString,
	SUPPORTER_DONATION_MIN_AMOUNT: optionalPositiveInt,
	SUPPORTER_DONATION_MAX_AMOUNT: optionalPositiveInt,
	SUPPORTER_ORDER_TTL_MINUTES: z.preprocess(
		(value) => (value === '' || value === undefined ? undefined : value),
		z.coerce.number().int().positive().default(30),
	),
	SEPAY_WEBHOOK_API_KEY: optionalEnvString,
	SEPAY_ACCOUNT_NUMBER: optionalEnvString,
	SEPAY_ACCOUNT_NAME: optionalEnvString,
	SEPAY_BANK_NAME: optionalEnvString,
	SEPAY_EXPECTED_GATEWAY: optionalEnvString,
	SEPAY_WEBHOOK_HOST: z.string().min(1).default('0.0.0.0'),
	SEPAY_WEBHOOK_PORT: z.preprocess(
		(value) => (value === '' || value === undefined ? undefined : value),
		z.coerce.number().int().min(1).max(65_535).default(8787),
	),
	SEPAY_WEBHOOK_PATH: z.string().startsWith('/').default('/webhooks/sepay'),
	KEYGATE_BASE_URL: optionalEnvString,
	KEYGATE_ADMIN_TOKEN: optionalEnvString,
	KEYGATE_PRODUCT_ID: optionalEnvString,
	KEYGATE_CONTRACT_VERIFIED: z
		.preprocess((value) => (value === '' ? undefined : value), z.enum(['true', 'false']).default('false'))
		.transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	// Fail fast: a bot with bad config should never half-start.
	console.error(ENV_ERROR_TEXT.invalidConfiguration, parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;
