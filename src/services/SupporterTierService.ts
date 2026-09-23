import {
	validateSupporterDonationConfig,
	type SupporterDonationConfig,
	type SupporterTier,
} from '../config/supporter.js';

export class SupporterTierService {
	private readonly config: SupporterDonationConfig;

	public constructor(config: SupporterDonationConfig) {
		this.config = validateSupporterDonationConfig(config);
	}

	public isValidDonationAmount(amount: number): boolean {
		return (
			Number.isSafeInteger(amount) &&
			amount >= this.config.donationMinimumAmount &&
			amount <= this.config.donationMaximumAmount
		);
	}

	/** Returns the highest threshold not exceeding amount, or null below the first tier. */
	public resolveTier(amount: number): SupporterTier | null {
		if (!this.isValidDonationAmount(amount)) return null;
		let resolved: SupporterTier | null = null;
		for (const tier of this.config.tiers) {
			if (tier.minimumAmount > amount) break;
			resolved = tier;
		}
		return resolved;
	}

	public getConfig(): SupporterDonationConfig {
		return this.config;
	}
}
