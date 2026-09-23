import { createHash, timingSafeEqual } from 'node:crypto';
import { DONATION_ERROR_TEXT } from '../../text/diagnostics.js';

export interface SepayWebhookPayload {
	id: string;
	accountNumber: string;
	gateway?: string;
	code?: string;
	content?: string;
	transferType: 'in' | 'out';
	transferAmount: number;
}

export interface SepayWebhookVerifierOptions {
	apiKey: string;
	expectedAccountNumber?: string;
	expectedGateway?: string;
	codePattern?: RegExp;
}

export interface SepayMatchExpectations {
	accountNumber?: string;
	gateway?: string;
	amount?: number;
	code?: string;
}

export interface SepayCodeResult {
	matched: boolean;
	code?: string;
	reason?: 'missing' | 'multiple' | 'conflicting' | 'invalid' | 'mismatch';
}

export interface SepayVerificationResult {
	accepted: boolean;
	payload?: SepayWebhookPayload;
	code?: string;
	reason?: 'unauthorized' | 'invalid_payload' | 'invalid_direction' | 'unmatched';
}

const DEFAULT_CODE_PATTERN = /ALPO[A-Z0-9]+/g;

/**
 * SePay documents `Authorization: Apikey <secret>`. Hashing both values first
 * makes timingSafeEqual safe when their original lengths differ as well.
 */
export function verifySepayApiKey(authorizationHeader: string | null | undefined, expectedApiKey: string): boolean {
	if (!authorizationHeader || !expectedApiKey) return false;
	const match = /^Apikey ([^\s]+)$/.exec(authorizationHeader);
	if (!match) return false;
	const actual = createHash('sha256').update(match[1]!, 'utf8').digest();
	const expected = createHash('sha256').update(expectedApiKey, 'utf8').digest();
	return timingSafeEqual(actual, expected);
}

/** Parse and normalize the documented SePay fields without coercing objects. */
export function parseSepayWebhookPayload(input: unknown): SepayWebhookPayload {
	if (!isRecord(input)) throw new TypeError(DONATION_ERROR_TEXT.invalidWebhookPayload);
	const id = asIdentifier(input.id);
	const accountNumber = asNonEmptyString(input.accountNumber);
	const transferType = input.transferType;
	const transferAmount = parsePositiveAmount(input.transferAmount);
	if (!id || !accountNumber || (transferType !== 'in' && transferType !== 'out') || transferAmount === undefined) {
		throw new TypeError(DONATION_ERROR_TEXT.invalidWebhookPayload);
	}
	let gateway: string | undefined;
	let code: string | undefined;
	let content: string | undefined;
	try {
		gateway = optionalString(input.gateway);
		code = optionalString(input.code);
		content = optionalString(input.content);
	} catch {
		throw new TypeError(DONATION_ERROR_TEXT.invalidWebhookPayload);
	}
	return { id, accountNumber, gateway, code, content, transferType, transferAmount };
}

/** Extract exactly one ALPO (or configured) code from code/content fields. */
export function extractSepayTransferCode(
	payload: Pick<SepayWebhookPayload, 'code' | 'content'>,
	pattern: RegExp = DEFAULT_CODE_PATTERN,
): SepayCodeResult {
	const values = [payload.code, payload.content].filter((value): value is string => Boolean(value));
	const found = new Set<string>();
	for (const value of values) {
		const matcher = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
		for (const match of value.matchAll(matcher)) found.add(match[0]);
	}
	if (found.size === 0) return { matched: false, reason: 'missing' };
	if (found.size > 1) return { matched: false, reason: 'multiple' };
	const [code] = [...found];
	if ((payload.code && !payload.code.includes(code)) || (payload.content && !payload.content.includes(code))) {
		return { matched: false, reason: 'conflicting' };
	}
	return { matched: true, code };
}

export function matchesSepayTransaction(
	payload: SepayWebhookPayload,
	expected: SepayMatchExpectations,
	codePattern?: RegExp,
): SepayCodeResult {
	if (payload.transferType !== 'in') return { matched: false, reason: 'invalid' };
	if (expected.accountNumber !== undefined && payload.accountNumber !== expected.accountNumber) {
		return { matched: false, reason: 'mismatch' };
	}
	if (expected.gateway !== undefined && payload.gateway !== expected.gateway) {
		return { matched: false, reason: 'mismatch' };
	}
	if (expected.amount !== undefined && payload.transferAmount !== expected.amount) {
		return { matched: false, reason: 'mismatch' };
	}
	const extracted = extractSepayTransferCode(payload, codePattern);
	if (!extracted.matched) return extracted;
	if (expected.code !== undefined && extracted.code !== expected.code) return { matched: false, reason: 'mismatch' };
	return extracted;
}

export class SepayWebhookVerifier {
	private readonly options: SepayWebhookVerifierOptions;

	constructor(options: SepayWebhookVerifierOptions) {
		if (!options.apiKey) throw new Error(DONATION_ERROR_TEXT.sepayApiKey);
		this.options = options;
	}

	verifyAuthorization(header: string | null | undefined): boolean {
		return verifySepayApiKey(header, this.options.apiKey);
	}

	verify(
		input: unknown,
		authorizationHeader: string | null | undefined,
		expected?: SepayMatchExpectations,
	): SepayVerificationResult {
		if (!this.verifyAuthorization(authorizationHeader)) return { accepted: false, reason: 'unauthorized' };
		let payload: SepayWebhookPayload;
		try {
			payload = parseSepayWebhookPayload(input);
		} catch {
			return { accepted: false, reason: 'invalid_payload' };
		}
		if (payload.transferType !== 'in') return { accepted: false, payload, reason: 'invalid_direction' };
		const result = matchesSepayTransaction(
			payload,
			{
				accountNumber: this.options.expectedAccountNumber,
				gateway: this.options.expectedGateway,
				...expected,
			},
			this.options.codePattern,
		);
		return result.matched
			? { accepted: true, payload, code: result.code }
			: { accepted: false, payload, reason: 'unmatched' };
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalString(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	const parsed = asNonEmptyString(value);
	if (!parsed) throw new TypeError(DONATION_ERROR_TEXT.emptyString);
	return parsed;
}

function asIdentifier(value: unknown): string | undefined {
	if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined;
	return asNonEmptyString(value);
}

function parsePositiveAmount(value: unknown): number | undefined {
	const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
	if (!/^\d+$/.test(text)) return undefined;
	const amount = Number(text);
	return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}
