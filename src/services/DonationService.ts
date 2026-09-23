import { randomBytes, randomUUID } from 'node:crypto';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { KeygateSupporterClient } from '../infrastructure/payments/KeygateSupporterClient.js';
import { SepayWebhookVerifier } from '../infrastructure/payments/SepayWebhookVerifier.js';
import { buildVietQrUrl } from '../infrastructure/payments/vietQr.js';
import {
	DonationRepository,
	type DonationGrantReceiptInput,
	type DonationOrderStatus,
	type SepayWebhookResult,
} from '../repositories/DonationRepository.js';
import { SupporterTierService } from './SupporterTierService.js';
import { validateSupporterEntitlements } from './SupporterEntitlementPolicy.js';
import type { DonationRuntimeConfig } from '../config/donationRuntime.js';
import { logger } from '../utils/logger.js';
import { DONATION_ERROR_TEXT, DONATION_LOG_TEXT } from '../text/diagnostics.js';

export type DonationCreateResult =
	| { status: 'disabled' }
	| { status: 'invalid-amount'; minimum: number; maximum: number }
	| {
			status: 'ok';
			orderId: string;
			paymentCode: string;
			amount: number;
			qrUrl: string;
			expiresAt: Date;
			bankName: string;
			accountNumber: string;
			accountName?: string;
			tier: { id: string; name: string; durationDays: number | null } | null;
	  };

export type DonationWebhookResult =
	| { status: 'unauthorized'; httpStatus: 401 }
	| { status: 'invalid-payload'; httpStatus: 400 }
	| { status: 'outgoing'; httpStatus: 200 }
	| { status: 'unmatched'; httpStatus: 200 }
	| { status: 'duplicate'; httpStatus: 200; orderId?: string }
	| { status: 'accepted'; httpStatus: 200; orderId: string; jobId: string };

export interface DonationServiceOptions {
	persistence?: PersistenceContext;
	repository?: DonationRepository;
	config?: DonationRuntimeConfig | null;
	now?: () => Date;
	codeBytes?: number;
}

export interface ProvisioningResult {
	status: 'disabled' | 'empty' | 'completed' | 'retry';
	jobId?: string;
	orderId?: string;
	error?: string;
}

export type DonationStatusResult =
	| { status: 'not-found' }
	| {
			status: 'found';
			orderId: string;
			amount: number;
			paymentCode: string;
			state: DonationOrderStatus;
			expiresAt: Date;
	  };

/** Coordinates donation checkout, SePay matching and retryable Keygate work. */
export class DonationService {
	private readonly persistence: PersistenceContext;
	private readonly repository: DonationRepository;
	private readonly config: DonationRuntimeConfig | null;
	private readonly now: () => Date;
	private readonly codeBytes: number;
	private readonly tiers: SupporterTierService | null;

	constructor(options: DonationServiceOptions = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.repository = options.repository ?? new DonationRepository(this.persistence.executor);
		this.config = options.config ?? null;
		this.tiers = this.config ? new SupporterTierService(this.config) : null;
		this.now = options.now ?? (() => new Date());
		this.codeBytes = options.codeBytes ?? 5;
	}

	async createOrder(discordId: string, amount: number, requestId?: string): Promise<DonationCreateResult> {
		if (!this.config) return { status: 'disabled' };
		const tiers = this.tiers!;
		if (!tiers.isValidDonationAmount(amount)) {
			return {
				status: 'invalid-amount',
				minimum: this.config.donationMinimumAmount,
				maximum: this.config.donationMaximumAmount,
			};
		}

		if (!discordId.trim()) throw new Error(DONATION_ERROR_TEXT.missingDiscordId);
		if (requestId) {
			const existing = await this.repository.findOrderByRequestId(requestId, this.persistence.executor);
			if (existing) {
				if (existing.discordId !== discordId || existing.amount !== amount)
					throw new Error(DONATION_ERROR_TEXT.requestConflict);
				return this.presentOrder(existing);
			}
		}
		const createdAt = this.now();
		const expiresAt = new Date(createdAt.getTime() + this.config.orderTtlMinutes * 60_000);
		const tier = tiers.resolveTier(amount);
		const orderId = randomUUID();
		const metadata = {
			requestId: requestId ?? null,
			currency: 'VND',
			tier: tier
				? {
						id: tier.id,
						name: tier.name,
						durationDays: tier.durationDays,
						keygatePlanSlug: tier.keygatePlanSlug,
					}
				: null,
			createdAt: createdAt.toISOString(),
		};

		let order: Awaited<ReturnType<DonationRepository['createOrder']>> | undefined;
		for (let attempt = 0; attempt < 5; attempt += 1) {
			const paymentCode = await this.uniquePaymentCode();
			try {
				order = await this.repository.createOrder(
					{
						orderId,
						discordId,
						amount,
						paymentCode,
						tierId: tier?.id ?? null,
						requestId,
						expiresAt,
						metadata,
					},
					this.persistence.executor,
				);
				break;
			} catch (error) {
				const databaseError = error as {
					code?: string;
					constraint?: string;
					cause?: { code?: string; constraint?: string };
				};
				const code = databaseError.code ?? databaseError.cause?.code;
				const constraint = databaseError.constraint ?? databaseError.cause?.constraint;
				if (code !== '23505' || constraint !== 'donation_orders_payment_code_unique') throw error;
			}
		}
		if (!order) throw new Error(DONATION_ERROR_TEXT.codeExhausted);

		if (order.discordId !== discordId || order.amount !== amount)
			throw new Error(DONATION_ERROR_TEXT.requestConflict);
		return this.presentOrder(order);
	}

	private presentOrder(order: Awaited<ReturnType<DonationRepository['createOrder']>>): DonationCreateResult {
		if (!this.config) return { status: 'disabled' };
		const tier = this.config.tiers.find((candidate) => candidate.id === order.tierId);
		return {
			status: 'ok',
			orderId: order.orderId,
			paymentCode: order.paymentCode,
			amount: order.amount,
			qrUrl: buildVietQrUrl({
				accountNumber: this.config.sepay.accountNumber,
				bank: this.config.sepay.bankName,
				amount: order.amount,
				description: order.paymentCode,
				template: 'compact',
			}),
			expiresAt: order.expiresAt,
			bankName: this.config.sepay.bankName,
			accountNumber: this.config.sepay.accountNumber,
			accountName: this.config.sepay.accountName,
			tier: tier ? { id: tier.id, name: tier.name, durationDays: tier.durationDays } : null,
		};
	}

	async getOrderStatus(discordId: string, orderId: string): Promise<DonationStatusResult> {
		const order = await this.repository.findOrderById(orderId, this.persistence.executor);
		if (!order || order.discordId !== discordId) return { status: 'not-found' };
		return {
			status: 'found',
			orderId: order.orderId,
			amount: order.amount,
			paymentCode: order.paymentCode,
			state:
				order.status === 'pending' && order.expiresAt <= this.now()
					? 'expired'
					: (order.status as DonationOrderStatus),
			expiresAt: order.expiresAt,
		};
	}

	async processSepayWebhook(
		payloadInput: unknown,
		authorizationHeader: string | null | undefined,
	): Promise<DonationWebhookResult> {
		if (!this.config) return { status: 'invalid-payload', httpStatus: 400 };
		const verifier = new SepayWebhookVerifier({
			apiKey: this.config.sepay.webhookApiKey,
			expectedAccountNumber: this.config.sepay.accountNumber,
			expectedGateway: this.config.sepay.expectedGateway,
		});
		const verified = verifier.verify(payloadInput, authorizationHeader);
		if (!verified.accepted) {
			if (verified.reason === 'unauthorized') return { status: 'unauthorized', httpStatus: 401 };
			if (verified.reason === 'invalid_payload') return { status: 'invalid-payload', httpStatus: 400 };
			if (verified.reason === 'invalid_direction') return { status: 'outgoing', httpStatus: 200 };
			return { status: 'unmatched', httpStatus: 200 };
		}
		const payload = verified.payload!;
		const paymentCode = verified.code!;

		const providerEventId = payload.id;
		const result: SepayWebhookResult = await this.persistence.unitOfWork.run((tx) =>
			this.repository.applySepayWebhook(
				{
					receiptId: `sepay:${providerEventId}`,
					providerEventId,
					transactionId: providerEventId,
					paymentCode,
					amount: payload.transferAmount,
					payload: payloadInput,
					jobId: `supporter:${paymentCode}`,
					now: this.now(),
				},
				tx,
			),
		);
		if (result.kind === 'duplicate') {
			if (result.payloadConflict) logger.warn({ providerEventId }, DONATION_LOG_TEXT.conflictingWebhook);
			return { status: 'duplicate', httpStatus: 200, orderId: result.orderId };
		}
		if (result.kind === 'unmatched') return { status: 'unmatched', httpStatus: 200 };
		return { status: 'accepted', httpStatus: 200, orderId: result.orderId, jobId: result.jobId };
	}

	/** Claims and provisions one durable job. A caller can invoke this from a worker loop. */
	async processNextProvisioningJob(keygate?: KeygateSupporterClient): Promise<ProvisioningResult> {
		if (!this.config || !keygate) return { status: 'disabled' };
		const job = await this.persistence.unitOfWork.run((tx) =>
			this.repository.claimNextProvisioningJob(this.now(), tx),
		);
		if (!job) return { status: 'empty' };
		const order = await this.repository.findOrderById(job.orderId, this.persistence.executor);
		if (!order) {
			await this.repository.failProvisioningJob(
				job.jobId,
				DONATION_ERROR_TEXT.missingOrder,
				this.retryAt(job.attempts),
				this.persistence.executor,
			);
			return { status: 'retry', jobId: job.jobId, orderId: job.orderId, error: DONATION_ERROR_TEXT.missingOrder };
		}
		await this.repository.markOrderProvisioning(order.orderId, this.persistence.executor);
		const tier = this.config.tiers.find((candidate) => candidate.id === order.tierId);
		try {
			let receipt: DonationGrantReceiptInput | null = null;
			if (order.tierId && !tier) throw new Error(DONATION_ERROR_TEXT.missingTier);
			if (tier) {
				const snapshot = (
					order.metadata as {
						tier?: { id?: unknown; keygatePlanSlug?: unknown; durationDays?: unknown };
					} | null
				)?.tier;
				if (
					!snapshot ||
					snapshot.id !== tier.id ||
					snapshot.keygatePlanSlug !== tier.keygatePlanSlug ||
					snapshot.durationDays !== tier.durationDays
				)
					throw new Error(DONATION_ERROR_TEXT.changedTier);
				const expiresAt =
					tier.durationDays === null || !order.paidAt
						? null
						: new Date(order.paidAt.getTime() + tier.durationDays * 86_400_000);
				const plan = await keygate.getPlan({ slug: tier.keygatePlanSlug });
				if (plan.slug !== tier.keygatePlanSlug || !plan.active)
					throw new Error(DONATION_ERROR_TEXT.planMismatch);
				const license =
					(await keygate.findLicenseByOperation(job.jobId)) ??
					(await keygate.ensureGrant({
						operationId: job.jobId,
						subject: order.discordId,
						planSlug: tier.keygatePlanSlug,
						expiresAt: expiresAt?.toISOString() ?? null,
						metadata: { orderId: order.orderId, paymentCode: order.paymentCode },
					}));
				if (
					license.operationId !== job.jobId ||
					license.subject !== order.discordId ||
					license.planId !== plan.id ||
					license.productId !== plan.productId ||
					license.status !== 'active' ||
					license.expiresAt !== (expiresAt?.toISOString() ?? null)
				)
					throw new Error(DONATION_ERROR_TEXT.grantMismatch);
				// The admin license/plan responses have no entitlement list. Never
				// mark an order active from an unverified Keygate capability set.
				const entitlements = validateSupporterEntitlements(plan.entitlements);
				receipt = {
					operationId: job.jobId,
					orderId: order.orderId,
					grantId: license.id,
					subject: order.discordId,
					planSlug: tier.keygatePlanSlug,
					expiresAt,
					entitlements,
				};
			}
			await this.persistence.unitOfWork.run(async (tx) => {
				if (receipt) await this.repository.recordGrantReceipt(receipt, tx);
				await this.repository.completeProvisioningJob(job.jobId, tx);
				await this.repository.markOrderActive(order.orderId, tx);
			});
			return { status: 'completed', jobId: job.jobId, orderId: order.orderId };
		} catch (error) {
			const message = error instanceof Error ? error.message : DONATION_ERROR_TEXT.provisionFailed;
			await this.repository.failProvisioningJob(
				job.jobId,
				message.slice(0, 500),
				this.retryAt(job.attempts),
				this.persistence.executor,
			);
			return { status: 'retry', jobId: job.jobId, orderId: order.orderId, error: message };
		}
	}

	private retryAt(attempts: number): Date {
		const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.min(attempts, 6));
		return new Date(this.now().getTime() + delay);
	}

	private async uniquePaymentCode(): Promise<string> {
		for (let attempt = 0; attempt < 5; attempt += 1) {
			const candidate = `ALPO${randomBytes(this.codeBytes).toString('hex').toUpperCase()}`;
			if (!(await this.repository.findOrderByPaymentCode(candidate, this.persistence.executor))) return candidate;
		}
		throw new Error(DONATION_ERROR_TEXT.codeExhausted);
	}
}

export type DonationOrderState = DonationOrderStatus;
