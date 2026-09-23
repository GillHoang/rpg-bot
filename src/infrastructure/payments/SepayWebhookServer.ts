import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { DonationService } from '../../services/DonationService.js';
import { DONATION_ERROR_TEXT } from '../../text/diagnostics.js';

export interface SepayWebhookServerOptions {
	service: Pick<DonationService, 'processSepayWebhook'>;
	host: string;
	port: number;
	path?: string;
	maxBodyBytes?: number;
}

/** Small dependency-free HTTP adapter for the SePay callback. */
export class SepayWebhookServer {
	private readonly server: Server;
	private readonly options: Required<SepayWebhookServerOptions>;

	constructor(options: SepayWebhookServerOptions) {
		if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535)
			throw new Error(DONATION_ERROR_TEXT.webhookPort);
		this.options = {
			...options,
			path: options.path ?? '/webhooks/sepay',
			maxBodyBytes: options.maxBodyBytes ?? 64 * 1024,
		};
		this.server = createServer((request, response) => {
			void this.handle(request, response);
		});
	}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const onError = (error: Error) => {
				this.server.off('listening', onListening);
				reject(error);
			};
			const onListening = () => {
				this.server.off('error', onError);
				resolve();
			};
			this.server.once('error', onError);
			this.server.once('listening', onListening);
			this.server.listen(this.options.port, this.options.host);
		});
	}

	stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.server.listening) {
				resolve();
				return;
			}
			this.server.close((error) => (error ? reject(error) : resolve()));
		});
	}

	private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
		if (request.method !== 'POST' || request.url?.split('?')[0] !== this.options.path) {
			this.writeJson(response, 404, { success: false, error: 'not_found' });
			return;
		}
		try {
			const payload = await readJson(request, this.options.maxBodyBytes);
			const result = await this.options.service.processSepayWebhook(payload, request.headers.authorization);
			this.writeJson(response, result.httpStatus, {
				success: result.status !== 'unauthorized' && result.status !== 'invalid-payload',
				status: result.status,
				...(result.status === 'accepted' ? { orderId: result.orderId, jobId: result.jobId } : {}),
				...(result.status === 'duplicate' && result.orderId ? { orderId: result.orderId } : {}),
			});
		} catch (error) {
			const invalidBody = error instanceof SyntaxError || error instanceof RequestBodyError;
			this.writeJson(response, invalidBody ? 400 : 500, {
				success: false,
				error: invalidBody ? 'invalid_body' : 'internal_error',
			});
		}
	}

	private writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
		response.statusCode = statusCode;
		response.setHeader('content-type', 'application/json; charset=utf-8');
		response.end(JSON.stringify(body));
	}
}

async function readJson(request: IncomingMessage, maxBytes: number): Promise<unknown> {
	let size = 0;
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > maxBytes) throw new RequestBodyError();
		chunks.push(buffer);
	}
	const body = Buffer.concat(chunks).toString('utf8');
	if (!body) throw new RequestBodyError();
	return JSON.parse(body) as unknown;
}

class RequestBodyError extends Error {}
