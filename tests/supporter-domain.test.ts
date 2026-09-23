import { describe, expect, it } from 'vitest';
import {
	extractSepayTransferCode,
	matchesSepayTransaction,
	parseSepayWebhookPayload,
	SepayWebhookVerifier,
	verifySepayApiKey,
} from '../src/infrastructure/payments/SepayWebhookVerifier.js';
import { buildVietQrUrl } from '../src/infrastructure/payments/vietQr.js';
import {
	SupporterConfigError,
	validateSupporterDonationConfig,
	type SupporterDonationConfig,
} from '../src/config/supporter.js';
import { SupporterTierService } from '../src/services/SupporterTierService.js';
import { validateSupporterEntitlements } from '../src/services/SupporterEntitlementPolicy.js';

const config = {
	donationMinimumAmount: 10_000,
	donationMaximumAmount: 500_000,
	tiers: [
		{ id: 'supporter', name: 'Supporter', minimumAmount: 20_000, durationDays: 30, keygatePlanSlug: 'supporter' },
		{
			id: 'plus',
			name: 'Supporter Plus',
			minimumAmount: 50_000,
			durationDays: 30,
			keygatePlanSlug: 'supporter-plus',
		},
		{
			id: 'elite',
			name: 'Supporter Elite',
			minimumAmount: 100_000,
			durationDays: null,
			keygatePlanSlug: 'supporter-elite',
		},
	],
} satisfies SupporterDonationConfig;

const sepayPayload = {
	id: 'evt-1',
	accountNumber: '0123',
	gateway: 'VCB',
	code: 'ALPOABC123',
	transferType: 'in' as const,
	transferAmount: 50_000,
};

describe('supporter domain', () => {
	it('resolves thresholds and enforces amount boundaries', () => {
		const service = new SupporterTierService(config);

		expect(service.isValidDonationAmount(9_999)).toBe(false);
		expect(service.isValidDonationAmount(10_000)).toBe(true);
		expect(service.isValidDonationAmount(10_000.5)).toBe(false);
		expect(service.isValidDonationAmount(500_000)).toBe(true);
		expect(service.isValidDonationAmount(500_001)).toBe(false);
		expect(service.isValidDonationAmount(Number.MAX_SAFE_INTEGER)).toBe(false);

		expect(service.resolveTier(19_999)).toBeNull();
		expect(service.resolveTier(20_000)?.id).toBe('supporter');
		expect(service.resolveTier(50_001)?.id).toBe('plus');
		expect(service.resolveTier(100_000)?.id).toBe('elite');
		expect(service.resolveTier(500_000)?.id).toBe('elite');
		expect(service.resolveTier(500_001)).toBeNull();
	});

	it('rejects malformed or unsafe tier configuration', () => {
		expect(() => validateSupporterDonationConfig({ ...config, tiers: [...config.tiers].reverse() })).toThrow(
			SupporterConfigError,
		);
		expect(() => validateSupporterDonationConfig({ ...config, tiers: [] })).toThrow(
			'at least one supporter tier is required',
		);
		expect(() =>
			validateSupporterDonationConfig({
				...config,
				tiers: [...config.tiers, { ...config.tiers[2], id: 'plus' }],
			}),
		).toThrow('duplicate or empty tier id');
		expect(() =>
			validateSupporterDonationConfig({
				...config,
				tiers: [{ ...config.tiers[0], keygatePlanSlug: ' ' }, ...config.tiers.slice(1)],
			}),
		).toThrow('Keygate plan slug');
		expect(() =>
			validateSupporterDonationConfig({
				...config,
				tiers: [{ ...config.tiers[0], durationDays: 0 }, ...config.tiers.slice(1)],
			}),
		).toThrow('durationDays');
	});

	it('allows only non-gameplay entitlement values and rejects duplicates', () => {
		expect(
			validateSupporterEntitlements([
				{ key: 'supporter_badge', value: true },
				{ key: 'supporter_title', value: 'Supporter' },
				{ key: 'supporter_role', value: 'supporter' },
			]),
		).toHaveLength(3);
		expect(() => validateSupporterEntitlements([{ key: 'xp_multiplier', value: 2 }])).toThrow(
			'unsupported entitlement key',
		);
		expect(() =>
			validateSupporterEntitlements([
				{ key: 'supporter_badge', value: true },
				{ key: 'supporter_badge', value: false },
			]),
		).toThrow('duplicate entitlement key');
		expect(() => validateSupporterEntitlements([{ key: 'supporter_badge', value: 'yes' }])).toThrow(
			'invalid supporter_badge value',
		);
		expect(() => validateSupporterEntitlements([{ key: 'supporter_title', value: ' ' }])).toThrow(
			'invalid supporter_title value',
		);
		expect(() => validateSupporterEntitlements([{ value: true }])).toThrow('must contain key and value');
	});

	it('generates encoded VietQR URL with exact amount and description', () => {
		const url = new URL(
			buildVietQrUrl({ bank: 'VCB', accountNumber: '0123', amount: 50_000, description: 'ALPOABC123' }),
		);
		expect(url.hostname).toBe('qr.sepay.vn');
		expect(url.searchParams.get('amount')).toBe('50000');
		expect(url.searchParams.get('des')).toBe('ALPOABC123');
		expect(url.searchParams.get('template')).toBeNull();
		expect(() => buildVietQrUrl({ bank: ' ', accountNumber: '0123', amount: 1, description: 'ALPO' })).toThrow(
			'bank and accountNumber',
		);
		expect(() => buildVietQrUrl({ bank: 'VCB', accountNumber: '0123', amount: 0, description: 'ALPO' })).toThrow(
			'positive safe integer',
		);
	});
});

describe('SePay webhook matching and security', () => {
	it('accepts only the exact documented API key header', () => {
		expect(verifySepayApiKey('Apikey secret', 'secret')).toBe(true);
		expect(verifySepayApiKey('apikey secret', 'secret')).toBe(false);
		expect(verifySepayApiKey('Apikey secret extra', 'secret')).toBe(false);
		expect(verifySepayApiKey('Apikey wrong', 'secret')).toBe(false);
		expect(verifySepayApiKey(undefined, 'secret')).toBe(false);
	});

	it('rejects unauthorized, malformed, outgoing and mismatched transactions', () => {
		const verifier = new SepayWebhookVerifier({
			apiKey: 'secret',
			expectedAccountNumber: '0123',
			expectedGateway: 'VCB',
		});
		expect(verifier.verify(sepayPayload, 'Apikey wrong')).toEqual({ accepted: false, reason: 'unauthorized' });
		expect(verifier.verify({ ...sepayPayload, transferAmount: 0 }, 'Apikey secret')).toEqual({
			accepted: false,
			reason: 'invalid_payload',
		});
		expect(verifier.verify({ ...sepayPayload, transferType: 'out' }, 'Apikey secret')).toMatchObject({
			accepted: false,
			reason: 'invalid_direction',
		});
		expect(verifier.verify({ ...sepayPayload, accountNumber: '9999' }, 'Apikey secret')).toMatchObject({
			accepted: false,
			reason: 'unmatched',
		});
		expect(verifier.verify({ ...sepayPayload, gateway: 'ACB' }, 'Apikey secret')).toMatchObject({
			accepted: false,
			reason: 'unmatched',
		});
		expect(verifier.verify({ ...sepayPayload, code: 'ALPOA', content: 'ALPOB' }, 'Apikey secret')).toMatchObject({
			accepted: false,
			reason: 'unmatched',
		});
	});

	it('normalizes payloads without coercing arbitrary objects and extracts one code', () => {
		expect(parseSepayWebhookPayload({ ...sepayPayload, id: 123, transferAmount: '50000' })).toMatchObject({
			id: '123',
			transferAmount: 50_000,
		});
		expect(() => parseSepayWebhookPayload(null)).toThrow('Invalid SePay webhook payload');
		expect(() => parseSepayWebhookPayload({ ...sepayPayload, transferAmount: { value: 50_000 } })).toThrow(
			'Invalid SePay webhook payload',
		);
		expect(extractSepayTransferCode({})).toEqual({ matched: false, reason: 'missing' });
		expect(extractSepayTransferCode({ code: 'ALPOA ALPOB' })).toEqual({ matched: false, reason: 'multiple' });
		expect(extractSepayTransferCode({ code: 'ALPOA', content: 'refund ALPOB' })).toEqual({
			matched: false,
			reason: 'multiple',
		});
		expect(extractSepayTransferCode({ code: 'ALPOA', content: 'paid ALPOA' })).toEqual({
			matched: true,
			code: 'ALPOA',
		});
	});

	it('checks direction and exact matching expectations', () => {
		expect(
			matchesSepayTransaction(sepayPayload, {
				accountNumber: '0123',
				gateway: 'VCB',
				amount: 50_000,
				code: 'ALPOABC123',
			}),
		).toEqual({ matched: true, code: 'ALPOABC123' });
		expect(matchesSepayTransaction(sepayPayload, { amount: 49_999 })).toEqual({
			matched: false,
			reason: 'mismatch',
		});
		expect(matchesSepayTransaction(sepayPayload, { code: 'ALPOOTHER' })).toEqual({
			matched: false,
			reason: 'mismatch',
		});
		expect(matchesSepayTransaction({ ...sepayPayload, transferType: 'out' }, {})).toEqual({
			matched: false,
			reason: 'invalid',
		});
	});

	it('returns the normalized payload and code on a valid callback', () => {
		const verifier = new SepayWebhookVerifier({
			apiKey: 'secret',
			expectedAccountNumber: '0123',
			expectedGateway: 'VCB',
		});
		expect(verifier.verify(sepayPayload, 'Apikey secret')).toEqual({
			accepted: true,
			payload: sepayPayload,
			code: 'ALPOABC123',
		});
	});
});
