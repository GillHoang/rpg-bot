import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { ErrorWebhook } from '../src/shared/utils/errorWebhook.js';

describe('error webhook', () => {
	it.each([
		[{ reason: 'failed', token: 'private' }, '{"reason":"failed","token":"[REDACTED]"}'],
		[null, 'Unknown error'],
		[42, '42'],
	])('formats structured and non-string messages: %j', async (msg, expected) => {
		const send = vi.fn(async (_payload: unknown) => {});
		const webhook = new ErrorWebhook(send);
		webhook.write(JSON.stringify({ level: 50, time: Date.now(), msg }));
		await webhook.flush();
		const payload = send.mock.calls[0][0] as { embeds: { description: string }[] };
		expect(payload.embeds[0].description).toContain(expected);
		expect(payload.embeds[0].description).not.toContain('[object Object]');
	});
	it('forwards errors and fatal logs with stack/context, redacts secrets and skips info', async () => {
		const send = vi.fn(async () => {});
		const webhook = new ErrorWebhook(send, ['bot-secret']);
		const logger = pino(
			{ serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err } },
			{
				write: (line) => webhook.write(line),
			},
		);
		logger.info('skip');
		logger.child({ command: 'raid' }).error({ error: new Error('bot-secret failed') }, 'Command failed');
		logger.fatal({ err: new Error('fatal'), password: 'hidden' }, 'Exiting');
		await webhook.flush();
		expect(send).toHaveBeenCalledTimes(2);
		const first = JSON.stringify(send.mock.calls[0]);
		expect(first).toContain('stack');
		expect(first).toContain('raid');
		expect(first).toContain('[REDACTED]');
		expect(first).not.toContain('bot-secret');
		expect(JSON.stringify(send.mock.calls[1])).not.toContain('hidden');
	});

	it('limits Discord descriptions and disables mentions', async () => {
		const send = vi.fn(async (_payload: unknown) => {});
		const webhook = new ErrorWebhook(send);
		webhook.write(JSON.stringify({ level: 50, time: Date.now(), msg: '@everyone' + 'x'.repeat(6000) }));
		await webhook.flush();
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				allowedMentions: { parse: [] },
				embeds: [expect.objectContaining({ description: expect.any(String) })],
			}),
		);
		const payload = send.mock.calls[0][0] as { embeds: { description: string }[] };
		expect(payload.embeds[0].description).toHaveLength(4096);
	});

	it('contains delivery failures without generating another notification', async () => {
		const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
		try {
			const send = vi.fn(async () => {
				throw new Error('webhook secret');
			});
			const webhook = new ErrorWebhook(send);
			webhook.write(JSON.stringify({ level: 50, time: Date.now(), msg: 'failure' }));
			await expect(webhook.flush()).resolves.toBeUndefined();
			expect(send).toHaveBeenCalledOnce();
			expect(stderr).toHaveBeenCalledWith('Error webhook delivery failed\n');
		} finally {
			stderr.mockRestore();
		}
	});

	it('bounds shutdown waiting when delivery is stuck', async () => {
		vi.useFakeTimers();
		try {
			const webhook = new ErrorWebhook(() => new Promise(() => {}));
			webhook.write(JSON.stringify({ level: 60, time: Date.now(), msg: 'fatal' }));
			const flush = webhook.flush(100);
			await vi.advanceTimersByTimeAsync(100);
			await expect(flush).resolves.toBeUndefined();
		} finally {
			vi.useRealTimers();
		}
	});
});
