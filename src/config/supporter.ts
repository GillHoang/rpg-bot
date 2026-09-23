import { SUPPORTER_CONFIG_ERROR_TEXT } from '../text/diagnostics.js';

/** Configuration for the voluntary supporter donation programme. */
export interface SupporterTier {
	id: string;
	name: string;
	minimumAmount: number;
	durationDays: number | null;
	keygatePlanSlug: string;
}

export interface SupporterDonationConfig {
	donationMinimumAmount: number;
	donationMaximumAmount: number;
	tiers: readonly SupporterTier[];
}

export class SupporterConfigError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'SupporterConfigError';
	}
}

/** Validate operator supplied configuration before donation is enabled. */
export function validateSupporterDonationConfig(config: SupporterDonationConfig): SupporterDonationConfig {
	if (!Number.isSafeInteger(config.donationMinimumAmount) || config.donationMinimumAmount <= 0) {
		throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.minimum);
	}
	if (
		!Number.isSafeInteger(config.donationMaximumAmount) ||
		config.donationMaximumAmount < config.donationMinimumAmount
	) {
		throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.maximum);
	}
	if (config.tiers.length === 0) throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.noTiers);
	const ids = new Set<string>();
	const slugs = new Set<string>();
	let previous = 0;
	for (const tier of config.tiers) {
		if (!tier.id.trim() || ids.has(tier.id))
			throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.duplicateId(tier.id));
		if (!tier.keygatePlanSlug.trim() || slugs.has(tier.keygatePlanSlug)) {
			throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.duplicateSlug(tier.keygatePlanSlug));
		}
		if (!tier.name.trim()) throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.emptyName(tier.id));
		if (!Number.isSafeInteger(tier.minimumAmount) || tier.minimumAmount <= previous) {
			throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.threshold);
		}
		if (tier.durationDays !== null && (!Number.isSafeInteger(tier.durationDays) || tier.durationDays <= 0)) {
			throw new SupporterConfigError(SUPPORTER_CONFIG_ERROR_TEXT.duration(tier.id));
		}
		ids.add(tier.id);
		slugs.add(tier.keygatePlanSlug);
		previous = tier.minimumAmount;
	}
	return config;
}
