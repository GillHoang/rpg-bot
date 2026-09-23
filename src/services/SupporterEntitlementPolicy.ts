import { SUPPORTER_POLICY_ERROR_TEXT } from '../text/diagnostics.js';

export type SupporterEntitlement =
	| { key: 'supporter_access'; value: boolean }
	| { key: 'supporter_badge'; value: boolean }
	| { key: 'supporter_role'; value: string }
	| { key: 'custom_profile'; value: boolean }
	| { key: 'custom_theme'; value: boolean }
	| { key: 'supporter_title'; value: string }
	| { key: 'supporter_credits'; value: boolean };

export const SUPPORTER_ENTITLEMENT_KEYS = [
	'supporter_access',
	'supporter_badge',
	'supporter_role',
	'custom_profile',
	'custom_theme',
	'supporter_title',
	'supporter_credits',
] as const;

export class SupporterEntitlementPolicyError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'SupporterEntitlementPolicyError';
	}
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

/** Strictly validates Keygate entitlement payloads and rejects unknown/P2W keys. */
export function validateSupporterEntitlements(input: unknown): SupporterEntitlement[] {
	if (!Array.isArray(input)) throw new SupporterEntitlementPolicyError(SUPPORTER_POLICY_ERROR_TEXT.notArray);
	const seen = new Set<string>();
	return input.map((raw, index) => {
		if (!raw || typeof raw !== 'object' || !('key' in raw) || !('value' in raw)) {
			throw new SupporterEntitlementPolicyError(SUPPORTER_POLICY_ERROR_TEXT.missingEntry(index));
		}
		const key = raw.key;
		if (typeof key !== 'string' || !(SUPPORTER_ENTITLEMENT_KEYS as readonly string[]).includes(key)) {
			throw new SupporterEntitlementPolicyError(SUPPORTER_POLICY_ERROR_TEXT.unsupportedKey(index));
		}
		if (seen.has(key)) throw new SupporterEntitlementPolicyError(SUPPORTER_POLICY_ERROR_TEXT.duplicateKey(key));
		seen.add(key);
		const value = raw.value;
		if (key === 'supporter_role' || key === 'supporter_title') {
			if (typeof value !== 'string' || value.trim().length === 0)
				throw new SupporterEntitlementPolicyError(SUPPORTER_POLICY_ERROR_TEXT.invalidValue(key));
			return { key, value } as SupporterEntitlement;
		}
		if (!isBoolean(value)) throw new SupporterEntitlementPolicyError(SUPPORTER_POLICY_ERROR_TEXT.invalidValue(key));
		return { key, value } as SupporterEntitlement;
	});
}

export class SupporterEntitlementPolicy {
	public validate(input: unknown): SupporterEntitlement[] {
		return validateSupporterEntitlements(input);
	}
	public static validate(input: unknown): SupporterEntitlement[] {
		return validateSupporterEntitlements(input);
	}
}
