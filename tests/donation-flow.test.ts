import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';

vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});

import { db, pool } from '../src/db/client.js';
import { defaultPersistence } from '../src/infrastructure/persistence/defaultPersistence.js';
import { DonationService } from '../src/services/DonationService.js';
import type { KeygateSupporterClient } from '../src/infrastructure/payments/KeygateSupporterClient.js';
import type { DonationRuntimeConfig } from '../src/config/donationRuntime.js';
import { donationGrantReceipts, donationOrders, donationProvisioningJobs } from '../src/db/schema.js';

const config: DonationRuntimeConfig = {
	donationMinimumAmount: 10_000,
	donationMaximumAmount: 500_000,
	tiers: [
		{
			id: 'plus',
			name: 'Supporter Plus',
			minimumAmount: 50_000,
			durationDays: 30,
			keygatePlanSlug: 'supporter-plus',
		},
	],
	orderTtlMinutes: 30,
	webhookHost: '127.0.0.1',
	webhookPort: 8787,
	webhookPath: '/webhooks/sepay',
	sepay: { webhookApiKey: 'secret', accountNumber: '0123', bankName: 'VCB', expectedGateway: 'VCB' },
	keygate: {
		baseUrl: 'https://example.test',
		token: 'token',
		productId: 'product-one',
	},
};

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
}, 30_000);
afterAll(() => pool.end());

describe('donation flow', () => {
	it('returns one order for a replayed interaction and accepts one matching webhook', async () => {
		const now = new Date('2026-09-23T00:00:00.000Z');
		const donations = new DonationService({ persistence: defaultPersistence, config, now: () => now });
		const first = await donations.createOrder('supporter-no-character', 50_000, 'interaction-one');
		const replay = await donations.createOrder('supporter-no-character', 50_000, 'interaction-one');
		expect(first).toEqual(replay);
		if (first.status !== 'ok') throw new Error(first.status);
		expect(first.paymentCode).toMatch(/^ALPO[A-F0-9]{10}$/);
		expect(await db.select().from(donationOrders)).toHaveLength(1);
		const payload = {
			id: 101,
			accountNumber: '0123',
			gateway: 'VCB',
			content: `donation ${first.paymentCode}`,
			transferType: 'in',
			transferAmount: 50_000,
		};
		const accepted = await donations.processSepayWebhook(payload, 'Apikey secret');
		expect(accepted).toMatchObject({ status: 'accepted', orderId: first.orderId });
		expect(await donations.processSepayWebhook(payload, 'Apikey secret')).toMatchObject({ status: 'duplicate' });
		expect(await db.select().from(donationProvisioningJobs)).toHaveLength(1);
		const fakeKeygate = {
			getPlan: vi.fn().mockResolvedValue({
				id: 'plan-one',
				productId: 'product-one',
				slug: 'supporter-plus',
				active: true,
				entitlements: [{ key: 'supporter_badge', value: true }],
			}),
			findLicenseByOperation: vi.fn().mockResolvedValue(null),
			ensureGrant: vi.fn().mockImplementation(async (request: Record<string, unknown>) => ({
				id: 'license-one',
				productId: 'product-one',
				planId: 'plan-one',
				subject: request.subject,
				operationId: request.operationId,
				expiresAt: request.expiresAt,
				status: 'active',
			})),
		} as unknown as KeygateSupporterClient;
		expect(await donations.processNextProvisioningJob(fakeKeygate)).toMatchObject({ status: 'completed' });
		expect(await db.select().from(donationGrantReceipts)).toHaveLength(1);
		expect(
			(await db.select().from(donationOrders).where(eq(donationOrders.orderId, first.orderId)))[0]?.status,
		).toBe('active');
		expect(await donations.processNextProvisioningJob(fakeKeygate)).toMatchObject({ status: 'empty' });
	});

	it('does not accept a payment after the QR expires', async () => {
		let current = new Date('2026-09-23T02:00:00.000Z');
		const donations = new DonationService({ persistence: defaultPersistence, config, now: () => current });
		const order = await donations.createOrder('late-supporter', 10_000, 'interaction-late');
		if (order.status !== 'ok') throw new Error(order.status);
		current = new Date('2026-09-23T03:00:00.000Z');
		expect(
			await donations.processSepayWebhook(
				{
					id: 102,
					accountNumber: '0123',
					gateway: 'VCB',
					content: order.paymentCode,
					transferType: 'in',
					transferAmount: 10_000,
				},
				'Apikey secret',
			),
		).toMatchObject({ status: 'unmatched' });
		expect(await donations.getOrderStatus('late-supporter', order.orderId)).toMatchObject({
			status: 'found',
			state: 'expired',
		});
		expect(await donations.getOrderStatus('other-user', order.orderId)).toEqual({ status: 'not-found' });
	});

	it('reconciles an unknown Keygate outcome before retrying a grant', async () => {
		let current = new Date('2026-09-23T04:00:00.000Z');
		const donations = new DonationService({ persistence: defaultPersistence, config, now: () => current });
		const order = await donations.createOrder('recovery-supporter', 50_000, 'interaction-recovery');
		if (order.status !== 'ok') throw new Error(order.status);
		await donations.processSepayWebhook(
			{
				id: 103,
				accountNumber: '0123',
				gateway: 'VCB',
				content: order.paymentCode,
				transferType: 'in',
				transferAmount: 50_000,
			},
			'Apikey secret',
		);
		let remoteGrant: Record<string, unknown> | null = null;
		const ensureGrant = vi.fn().mockImplementation(async (request: Record<string, unknown>) => {
			remoteGrant = {
				id: 'license-recovered',
				productId: 'product-one',
				planId: 'plan-one',
				subject: request.subject,
				operationId: request.operationId,
				expiresAt: request.expiresAt,
				status: 'active',
			};
			throw new Error('request timed out after provider commit');
		});
		const keygate = {
			getPlan: vi.fn().mockResolvedValue({
				id: 'plan-one',
				productId: 'product-one',
				slug: 'supporter-plus',
				active: true,
				entitlements: [{ key: 'supporter_badge', value: true }],
			}),
			findLicenseByOperation: vi.fn().mockImplementation(async () => remoteGrant),
			ensureGrant,
		} as unknown as KeygateSupporterClient;
		expect(await donations.processNextProvisioningJob(keygate)).toMatchObject({ status: 'retry' });
		current = new Date(current.getTime() + 31_000);
		expect(await donations.processNextProvisioningJob(keygate)).toMatchObject({ status: 'completed' });
		expect(ensureGrant).toHaveBeenCalledOnce();
		expect(
			await db.select().from(donationGrantReceipts).where(eq(donationGrantReceipts.orderId, order.orderId)),
		).toHaveLength(1);
	});
});
