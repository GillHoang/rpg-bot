import { env } from './env.js';
import { validateSupporterDonationConfig, type SupporterDonationConfig } from './supporter.js';

export interface DonationRuntimeConfig extends SupporterDonationConfig {
	orderTtlMinutes: number;
	webhookHost: string;
	webhookPort: number;
	webhookPath: string;
	sepay: {
		webhookApiKey: string;
		accountNumber: string;
		accountName?: string;
		bankName: string;
		expectedGateway?: string;
	};
	keygate: {
		baseUrl: string;
		token: string;
		productId: string;
	};
}

/** tabloy/keygate's admin license creation has no durable operation dedupe. */
export const KEYGATE_LICENSE_PROVISIONING_SUPPORTED = false;

/**
 * Donation is deliberately fail-closed. A normal bot boot must work without
 * payment credentials, while an operator who enables donations must provide a
 * complete, validated configuration before a QR or webhook is exposed.
 */
export function loadDonationRuntimeConfig(source: typeof env = env): DonationRuntimeConfig | null {
	if (!source.SUPPORTER_DONATIONS_ENABLED) return null;
	if (!source.KEYGATE_CONTRACT_VERIFIED) return null;
	if (!KEYGATE_LICENSE_PROVISIONING_SUPPORTED) return null;
	if (
		!source.SUPPORTER_TIERS_JSON ||
		source.SUPPORTER_DONATION_MIN_AMOUNT === undefined ||
		source.SUPPORTER_DONATION_MAX_AMOUNT === undefined ||
		!source.SEPAY_WEBHOOK_API_KEY ||
		!source.SEPAY_ACCOUNT_NUMBER ||
		!source.SEPAY_BANK_NAME ||
		!source.KEYGATE_BASE_URL ||
		!source.KEYGATE_ADMIN_TOKEN ||
		!source.KEYGATE_PRODUCT_ID
	)
		return null;
	try {
		const url = new URL(source.KEYGATE_BASE_URL);
		if (url.protocol !== 'https:') return null;
	} catch {
		return null;
	}

	let tiers: unknown;
	try {
		tiers = JSON.parse(source.SUPPORTER_TIERS_JSON);
	} catch {
		return null;
	}
	if (!Array.isArray(tiers)) return null;

	try {
		const config = validateSupporterDonationConfig({
			donationMinimumAmount: source.SUPPORTER_DONATION_MIN_AMOUNT,
			donationMaximumAmount: source.SUPPORTER_DONATION_MAX_AMOUNT,
			tiers: tiers as SupporterDonationConfig['tiers'],
		});
		return {
			...config,
			orderTtlMinutes: source.SUPPORTER_ORDER_TTL_MINUTES,
			webhookHost: source.SEPAY_WEBHOOK_HOST,
			webhookPort: source.SEPAY_WEBHOOK_PORT,
			webhookPath: source.SEPAY_WEBHOOK_PATH,
			sepay: {
				webhookApiKey: source.SEPAY_WEBHOOK_API_KEY,
				accountNumber: source.SEPAY_ACCOUNT_NUMBER,
				accountName: source.SEPAY_ACCOUNT_NAME,
				bankName: source.SEPAY_BANK_NAME,
				expectedGateway: source.SEPAY_EXPECTED_GATEWAY,
			},
			keygate: {
				baseUrl: source.KEYGATE_BASE_URL,
				token: source.KEYGATE_ADMIN_TOKEN,
				productId: source.KEYGATE_PRODUCT_ID,
			},
		};
	} catch {
		return null;
	}
}
