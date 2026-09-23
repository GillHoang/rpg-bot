import { and, eq, gt, lte, or, sql } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { DONATION_ERROR_TEXT } from '../text/diagnostics.js';
import {
	donationOrders,
	donationGrantReceipts,
	donationProvisioningJobs,
	donationWebhookReceipts,
} from '../db/schema.js';

export type DonationOrderStatus = 'pending' | 'paid' | 'provisioning' | 'active' | 'failed' | 'expired';
export type DonationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export const DEFAULT_PROVISIONING_LEASE_MS = 5 * 60_000;

export interface CreateDonationOrderInput {
	orderId: string;
	discordId: string;
	amount: number;
	paymentCode: string;
	tierId: string | null;
	/** Stable Discord interaction ID. Retries return the existing order. */
	requestId?: string | null;
	expiresAt: Date;
	metadata?: unknown;
}

export interface SepayWebhookInput {
	receiptId: string;
	providerEventId: string;
	transactionId: string;
	paymentCode: string;
	amount: number;
	payload: unknown;
	jobId: string;
	/** Matching time used for the pending-order expiry check. */
	now?: Date;
}

export interface DonationGrantReceiptInput {
	operationId: string;
	orderId: string;
	grantId?: string | null;
	subject: string;
	planSlug: string;
	expiresAt: Date | null;
	entitlements: unknown;
}

export type SepayWebhookResult =
	| { kind: 'accepted'; orderId: string; jobId: string }
	| { kind: 'duplicate'; orderId?: string; payloadConflict?: boolean }
	| { kind: 'unmatched' };

export class DonationRepository {
	constructor(private readonly executor: Executor = db) {}

	async createOrder(input: CreateDonationOrderInput, executor: Executor = this.executor) {
		const [row] = await executor
			.insert(donationOrders)
			.values({ ...input, requestId: input.requestId ?? null, status: 'pending' })
			.onConflictDoNothing({ target: donationOrders.requestId })
			.returning();
		if (row) return row;
		if (input.requestId) {
			const existing = await this.findOrderByRequestId(input.requestId, executor);
			if (existing) return existing;
		}
		throw new Error(DONATION_ERROR_TEXT.createFailed(input.orderId));
	}

	async findOrderById(orderId: string, executor: Executor = this.executor) {
		const [row] = await executor.select().from(donationOrders).where(eq(donationOrders.orderId, orderId)).limit(1);
		return row ?? null;
	}

	async findOrderByPaymentCode(paymentCode: string, executor: Executor = this.executor) {
		const [row] = await executor
			.select()
			.from(donationOrders)
			.where(eq(donationOrders.paymentCode, paymentCode))
			.limit(1);
		return row ?? null;
	}

	async findOrderByRequestId(requestId: string, executor: Executor = this.executor) {
		const [row] = await executor
			.select()
			.from(donationOrders)
			.where(eq(donationOrders.requestId, requestId))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Atomically records a provider event, marks the matching pending order paid,
	 * and creates the idempotent Keygate outbox job. Pass a transaction executor
	 * from the webhook service so all three writes commit together.
	 */
	async applySepayWebhook(input: SepayWebhookInput, executor: Executor = this.executor): Promise<SepayWebhookResult> {
		const [receipt] = await executor
			.insert(donationWebhookReceipts)
			.values({
				receiptId: input.receiptId,
				providerEventId: input.providerEventId,
				transactionId: input.transactionId,
				payload: input.payload,
			})
			.onConflictDoNothing()
			.returning();

		if (!receipt) {
			const existingRows = await executor
				.select({
					orderId: donationWebhookReceipts.orderId,
					providerEventId: donationWebhookReceipts.providerEventId,
					transactionId: donationWebhookReceipts.transactionId,
					payload: donationWebhookReceipts.payload,
				})
				.from(donationWebhookReceipts)
				.where(
					or(
						eq(donationWebhookReceipts.providerEventId, input.providerEventId),
						eq(donationWebhookReceipts.transactionId, input.transactionId),
					),
				)
				.limit(2);
			const [existing] = existingRows;
			return {
				kind: 'duplicate',
				orderId: existing?.orderId ?? undefined,
				payloadConflict:
					existingRows.length > 1 ||
					existingRows.some(
						(row) =>
							row.providerEventId !== input.providerEventId ||
							row.transactionId !== input.transactionId ||
							!sameJson(row.payload, input.payload),
					),
			};
		}

		const now = input.now ?? new Date();
		const [order] = await executor
			.update(donationOrders)
			.set({ status: 'paid', paidAt: now, sepayTransactionId: input.transactionId, updatedAt: now })
			.where(
				and(
					eq(donationOrders.paymentCode, input.paymentCode),
					eq(donationOrders.amount, input.amount),
					eq(donationOrders.status, 'pending'),
					gt(donationOrders.expiresAt, now),
				),
			)
			.returning({ orderId: donationOrders.orderId });

		if (!order) {
			await executor
				.update(donationWebhookReceipts)
				.set({ status: 'unmatched', processedAt: new Date() })
				.where(eq(donationWebhookReceipts.receiptId, input.receiptId));
			return { kind: 'unmatched' };
		}

		await executor
			.update(donationWebhookReceipts)
			.set({ orderId: order.orderId, status: 'accepted', processedAt: new Date() })
			.where(eq(donationWebhookReceipts.receiptId, input.receiptId));
		await executor
			.insert(donationProvisioningJobs)
			.values({ jobId: input.jobId, orderId: order.orderId, status: 'pending', nextAttemptAt: now })
			.onConflictDoNothing({ target: donationProvisioningJobs.orderId });

		return { kind: 'accepted', orderId: order.orderId, jobId: input.jobId };
	}

	async claimNextProvisioningJob(
		now = new Date(),
		executor: Executor = this.executor,
		leaseDurationMs = DEFAULT_PROVISIONING_LEASE_MS,
	) {
		if (!Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
			throw new Error(DONATION_ERROR_TEXT.leaseDuration);
		}
		const staleBefore = new Date(now.getTime() - leaseDurationMs);
		const [job] = await executor
			.select()
			.from(donationProvisioningJobs)
			.where(
				or(
					and(
						eq(donationProvisioningJobs.status, 'pending'),
						lte(donationProvisioningJobs.nextAttemptAt, now),
					),
					and(
						eq(donationProvisioningJobs.status, 'processing'),
						lte(donationProvisioningJobs.lockedAt, staleBefore),
					),
				),
			)
			.limit(1);
		if (!job) return null;
		const [claimed] = await executor
			.update(donationProvisioningJobs)
			.set({ status: 'processing', lockedAt: now, updatedAt: now })
			.where(
				and(
					eq(donationProvisioningJobs.jobId, job.jobId),
					or(
						eq(donationProvisioningJobs.status, 'pending'),
						and(
							eq(donationProvisioningJobs.status, 'processing'),
							lte(donationProvisioningJobs.lockedAt, staleBefore),
						),
					),
				),
			)
			.returning();
		return claimed ?? null;
	}

	async completeProvisioningJob(jobId: string, executor: Executor = this.executor): Promise<void> {
		await executor
			.update(donationProvisioningJobs)
			.set({ status: 'completed', lockedAt: null, updatedAt: new Date() })
			.where(and(eq(donationProvisioningJobs.jobId, jobId), eq(donationProvisioningJobs.status, 'processing')));
	}

	async recordGrantReceipt(input: DonationGrantReceiptInput, executor: Executor = this.executor): Promise<void> {
		const [recorded] = await executor
			.insert(donationGrantReceipts)
			.values(input)
			.onConflictDoNothing()
			.returning({ operationId: donationGrantReceipts.operationId });
		if (!recorded) throw new Error(DONATION_ERROR_TEXT.grantReceiptConflict);
	}

	async markOrderProvisioning(orderId: string, executor: Executor = this.executor): Promise<void> {
		await executor
			.update(donationOrders)
			.set({ status: 'provisioning', updatedAt: new Date() })
			.where(and(eq(donationOrders.orderId, orderId), eq(donationOrders.status, 'paid')));
	}

	async markOrderActive(orderId: string, executor: Executor = this.executor): Promise<void> {
		await executor
			.update(donationOrders)
			.set({ status: 'active', updatedAt: new Date() })
			.where(and(eq(donationOrders.orderId, orderId), eq(donationOrders.status, 'provisioning')));
	}

	async failProvisioningJob(
		jobId: string,
		error: string,
		nextAttemptAt: Date,
		executor: Executor = this.executor,
	): Promise<void> {
		await executor
			.update(donationProvisioningJobs)
			.set({
				status: 'pending',
				attempts: sql`${donationProvisioningJobs.attempts} + 1`,
				lastError: error,
				nextAttemptAt,
				lockedAt: null,
				updatedAt: new Date(),
			})
			.where(and(eq(donationProvisioningJobs.jobId, jobId), eq(donationProvisioningJobs.status, 'processing')));
	}
}

/** Compare JSON payloads without treating object key ordering as a mismatch. */
function sameJson(left: unknown, right: unknown): boolean {
	try {
		return JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right));
	} catch {
		return false;
	}
}

function normalizeJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeJson);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, normalizeJson(entry)]),
		);
	}
	return value;
}
