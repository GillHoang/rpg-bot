import { describe, expect, it, vi } from 'vitest';
import { KeygateSupporterClient } from '../src/infrastructure/payments/KeygateSupporterClient.js';
import { env } from '../src/config/env.js';
import { loadDonationRuntimeConfig } from '../src/config/donationRuntime.js';

const options = { baseUrl: 'https://keygate.example', token: 'test-token', productId: 'product-one' };

describe('tabloy Keygate adapter', () => {
	it('resolves a plan by exact slug from the product-scoped admin list', async () => {
		const request = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					success: true,
					data: {
						plans: [
							{ id: 'plan-other', product_id: 'product-one', slug: 'other', active: true },
							{ id: 'plan-one', product_id: 'product-one', slug: 'supporter', active: true },
						],
					},
				}),
			),
		);
		const client = new KeygateSupporterClient({ ...options, fetch: request });
		expect(await client.getPlan({ slug: 'supporter' })).toEqual({
			id: 'plan-one',
			productId: 'product-one',
			slug: 'supporter',
			active: true,
		});
		expect(request).toHaveBeenCalledWith(
			'https://keygate.example/api/v1/admin/plans?product_id=product-one',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
			}),
		);
	});

	it('finds one license by operation and rejects duplicate matches', async () => {
		const license = {
			id: 'license-one',
			product_id: 'product-one',
			plan_id: 'plan-one',
			email: 'operator@example.test',
			external_customer_id: 'discord-user',
			external_workspace_id: 'operation-one',
			valid_until: '2026-10-23T00:00:00Z',
			status: 'active',
		};
		const request = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: true, data: { licenses: [license], total: 1 } })),
			);
		const client = new KeygateSupporterClient({ ...options, fetch: request });
		expect(await client.findLicenseByOperation('operation-one')).toMatchObject({
			id: 'license-one',
			planId: 'plan-one',
			subject: 'discord-user',
			operationId: 'operation-one',
		});
		expect(request.mock.calls[0]?.[0]).toBe(
			'https://keygate.example/api/v1/admin/licenses?product_id=product-one&external_workspace_id=operation-one&limit=2',
		);
		request.mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, data: { licenses: [license, license], total: 2 } })),
		);
		await expect(client.findLicenseByOperation('operation-one')).rejects.toThrow('multiple licenses');
	});

	it('never sends a non-idempotent license creation request', async () => {
		const request = vi.fn<typeof fetch>();
		const client = new KeygateSupporterClient({ ...options, fetch: request });
		await expect(
			client.ensureGrant({ operationId: 'one', subject: 'discord-user', planSlug: 'supporter' }),
		).rejects.toThrow('no durable idempotency guarantee');
		expect(request).not.toHaveBeenCalled();
	});

	it('keeps payment disabled even when both operator switches are true', () => {
		expect(
			loadDonationRuntimeConfig({
				...env,
				SUPPORTER_DONATIONS_ENABLED: true,
				KEYGATE_CONTRACT_VERIFIED: true,
			}),
		).toBeNull();
	});
});
