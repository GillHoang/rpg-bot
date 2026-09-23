import { KEYGATE_ERROR_TEXT } from '../../text/diagnostics.js';

/** Read-only adapter for tabloy/keygate's /api/v1/admin API. */
export interface KeygateSupporterClientOptions {
	baseUrl: string;
	token: string;
	productId: string;
	fetch?: typeof fetch;
	timeoutMs?: number;
}

export interface KeygatePlan {
	id: string;
	productId: string;
	slug: string;
	active: boolean;
	/** Keygate's admin plan response does not include entitlements. */
	entitlements?: unknown;
}

export interface KeygateLicense {
	id: string;
	productId: string;
	planId: string;
	email: string;
	subject: string;
	operationId: string;
	expiresAt: string | null;
	status: string;
}

export interface KeygateGrantRequest {
	operationId: string;
	subject: string;
	planSlug: string;
	expiresAt?: string | null;
	metadata?: Record<string, string>;
}

export class KeygateHttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryable: boolean,
	) {
		super(message);
		this.name = 'KeygateHttpError';
	}
}

export class KeygateSupporterClient {
	private readonly baseUrl: string;
	private readonly token: string;
	private readonly productId: string;
	private readonly requestFetch: typeof fetch;
	private readonly timeoutMs: number;

	constructor(options: KeygateSupporterClientOptions) {
		const url = new URL(options.baseUrl);
		if (url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password || url.search || url.hash)
			throw new Error(KEYGATE_ERROR_TEXT.baseUrl);
		if (!options.token) throw new Error(KEYGATE_ERROR_TEXT.token);
		if (!options.productId.trim()) throw new Error(KEYGATE_ERROR_TEXT.productId);
		this.baseUrl = url.toString().replace(/\/+$/, '');
		this.token = options.token;
		this.productId = options.productId;
		this.requestFetch = options.fetch ?? fetch;
		this.timeoutMs = options.timeoutMs ?? 10_000;
	}

	/** Keygate lists plans; its detail route accepts an ID, not a slug. */
	async getPlan(request: { slug: string }, signal?: AbortSignal): Promise<KeygatePlan> {
		const query = new URLSearchParams({ product_id: this.productId });
		const data = await this.getData(`/api/v1/admin/plans?${query}`, signal);
		const plans = record(data)?.plans;
		if (!Array.isArray(plans)) throw new Error(KEYGATE_ERROR_TEXT.invalidResponse);
		const matches = plans.filter((entry) => {
			const plan = record(entry);
			return plan?.product_id === this.productId && plan.slug === request.slug;
		});
		if (matches.length !== 1) throw new Error(KEYGATE_ERROR_TEXT.planCount);
		const plan = record(matches[0])!;
		if (typeof plan.id !== 'string' || typeof plan.active !== 'boolean')
			throw new Error(KEYGATE_ERROR_TEXT.invalidResponse);
		return { id: plan.id, productId: this.productId, slug: request.slug, active: plan.active };
	}

	/** External workspace ID is searchable, but Keygate does not make it unique. */
	async findLicenseByOperation(operationId: string, signal?: AbortSignal): Promise<KeygateLicense | null> {
		const query = new URLSearchParams({
			product_id: this.productId,
			external_workspace_id: operationId,
			limit: '2',
		});
		const data = await this.getData(`/api/v1/admin/licenses?${query}`, signal);
		const result = record(data);
		if (!result || !Array.isArray(result.licenses) || typeof result.total !== 'number')
			throw new Error(KEYGATE_ERROR_TEXT.invalidResponse);
		if (result.total > 1 || result.licenses.length > 1) throw new Error(KEYGATE_ERROR_TEXT.duplicateLicense);
		if (result.total === 0 && result.licenses.length === 0) return null;
		if (result.total !== 1 || result.licenses.length !== 1) throw new Error(KEYGATE_ERROR_TEXT.invalidResponse);
		const license = record(result.licenses[0]);
		if (
			!license ||
			typeof license.id !== 'string' ||
			license.product_id !== this.productId ||
			typeof license.plan_id !== 'string' ||
			typeof license.email !== 'string' ||
			typeof license.external_customer_id !== 'string' ||
			license.external_workspace_id !== operationId ||
			typeof license.status !== 'string' ||
			(license.valid_until !== undefined &&
				license.valid_until !== null &&
				typeof license.valid_until !== 'string')
		)
			throw new Error(KEYGATE_ERROR_TEXT.invalidResponse);
		return {
			id: license.id,
			productId: this.productId,
			planId: license.plan_id,
			email: license.email,
			subject: license.external_customer_id,
			operationId,
			expiresAt: (license.valid_until as string | null | undefined) ?? null,
			status: license.status,
		};
	}

	/**
	 * POST /admin/licenses is not idempotent. Its Idempotency-Key header is ignored,
	 * and external_workspace_id has no unique constraint. Never issue a paid
	 * license through this API until Keygate provides durable deduplication.
	 */
	async ensureGrant(_request: KeygateGrantRequest, _signal?: AbortSignal): Promise<never> {
		throw new Error(KEYGATE_ERROR_TEXT.unsafeLicenseCreate);
	}

	private async getData(path: string, signal?: AbortSignal): Promise<unknown> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const onAbort = () => controller.abort();
		signal?.addEventListener('abort', onAbort, { once: true });
		try {
			const response = await this.requestFetch(`${this.baseUrl}${path}`, {
				method: 'GET',
				headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` },
				signal: controller.signal,
			});
			if (!response.ok) {
				throw new KeygateHttpError(
					KEYGATE_ERROR_TEXT.http(
						response.status >= 500 ? KEYGATE_ERROR_TEXT.serverError : KEYGATE_ERROR_TEXT.rejected,
						response.status,
					),
					response.status,
					response.status >= 500 || response.status === 408 || response.status === 429,
				);
			}
			const envelope = record(await response.json());
			if (!envelope || envelope.success !== true || !('data' in envelope))
				throw new Error(KEYGATE_ERROR_TEXT.invalidResponse);
			return envelope.data;
		} catch (error) {
			if (
				error instanceof KeygateHttpError ||
				(error instanceof Error && error.message === KEYGATE_ERROR_TEXT.invalidResponse)
			)
				throw error;
			if (error instanceof DOMException && error.name === 'AbortError')
				throw new KeygateHttpError(KEYGATE_ERROR_TEXT.timeout, 408, true);
			throw new KeygateHttpError(KEYGATE_ERROR_TEXT.requestFailed, 503, true);
		} finally {
			clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
		}
	}
}

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}
